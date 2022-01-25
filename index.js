/* eslint-disable prefer-promise-reject-errors */
// node-pdf
const path = require('path');
const fs = require('fs');
const util = require('util');
const { exec } = require('child_process');

function PDFImage(pdfFilePath, options = {}) {
  this.pdfFilePath = pdfFilePath;

  this.setPdfFileBaseName(options.pdfFileBaseName);
  this.setConvertOptions(options.convertOptions);
  this.setConvertExtension(options.convertExtension);
  this.useGM = options.graphicsMagick || false;
  this.combinedImage = options.combinedImage || false;

  this.outputDirectory = options.outputDirectory || path.dirname(pdfFilePath);
}

PDFImage.prototype = {
  constructGetInfoCommand() {
    return util.format(
      'pdfinfo "%s"',
      this.pdfFilePath,
    );
  },
  parseGetInfoCommandOutput(output) {
    const info = {};
    output.split('\n').forEach((line) => {
      if (line.match(/^(.*?):[ \t]*(.*)$/)) {
        info[RegExp.$1] = RegExp.$2;
      }
    });
    return info;
  },
  getInfo() {
    const self = this;
    const getInfoCommand = this.constructGetInfoCommand();
    const promise = new Promise((resolve, reject) => {
      exec(getInfoCommand, (err, stdout, stderr) => {
        if (err) {
          return reject({
            message: "Failed to get PDF'S information",
            error: err,
            stdout,
            stderr,
          });
        }
        return resolve(self.parseGetInfoCommandOutput(stdout));
      });
    });
    return promise;
  },
  numberOfPages() {
    return this.getInfo().then((info) => info.Pages);
  },
  getOutputImagePathForPage(pageNumber) {
    return path.join(
      this.outputDirectory,
      `${this.pdfFileBaseName}-${pageNumber}.${this.convertExtension}`,
    );
  },
  getOutputImagePathForFile() {
    return path.join(
      this.outputDirectory,
      `${this.pdfFileBaseName}.${this.convertExtension}`,
    );
  },
  setConvertOptions(convertOptions) {
    this.convertOptions = convertOptions || {};
  },
  setPdfFileBaseName(pdfFileBaseName) {
    this.pdfFileBaseName = pdfFileBaseName || path.basename(this.pdfFilePath, '.pdf');
  },
  setConvertExtension(convertExtension) {
    this.convertExtension = convertExtension || 'png';
  },
  constructConvertCommandForPage(pageNumber) {
    const { pdfFilePath } = this;
    const outputImagePath = this.getOutputImagePathForPage(pageNumber);
    const convertOptionsString = this.constructConvertOptions();
    return util.format(
      '%s %s"%s[%d]" "%s"',
      this.useGM ? 'gm convert' : 'convert',
      convertOptionsString ? `${convertOptionsString} ` : '',
      pdfFilePath,
      pageNumber,
      outputImagePath,
    );
  },
  constructCombineCommandForFile(imagePaths) {
    return util.format(
      '%s -append %s "%s"',
      this.useGM ? 'gm convert' : 'convert',
      imagePaths.join(' '),
      this.getOutputImagePathForFile(),
    );
  },
  constructConvertOptions() {
    return Object.keys(this.convertOptions).sort().map((optionName) => {
      if (this.convertOptions[optionName] !== null) {
        return `${optionName} ${this.convertOptions[optionName]}`;
      }
      return optionName;
    }, this).join(' ');
  },
  combineImages(imagePaths) {
    const pdfImage = this;
    const combineCommand = pdfImage.constructCombineCommandForFile(imagePaths);
    return new Promise((resolve, reject) => {
      exec(combineCommand, (err, stdout, stderr) => {
        if (err) {
          return reject({
            message: 'Failed to combine images',
            error: err,
            stdout,
            stderr,
          });
        }
        exec(`rm ${imagePaths.join(' ')}`); // cleanUp
        return resolve(pdfImage.getOutputImagePathForFile());
      });
    });
  },
  convertFile() {
    const pdfImage = this;
    return new Promise((resolve, reject) => {
      pdfImage.numberOfPages().then((totalPages) => {
        // eslint-disable-next-line no-shadow
        const convertPromise = new Promise((resolve, reject) => {
          const imagePaths = [];
          for (let i = 0; i < totalPages; i += 1) {
            pdfImage.convertPage(i).then((imagePath) => {
              imagePaths.push(imagePath);
              if (imagePaths.length === parseInt(totalPages, 10)) {
                imagePaths.sort(); // because of asyc pages we have to reSort pages
                resolve(imagePaths);
              }
            }).catch((error) => {
              reject(error);
            });
          }
        });

        convertPromise.then((imagePaths) => {
          if (pdfImage.combinedImage) {
            pdfImage.combineImages(imagePaths).then((imagePath) => {
              resolve(imagePath);
            });
          } else {
            resolve(imagePaths);
          }
        }).catch((error) => {
          reject(error);
        });
      });
    });
  },
  convertPage(pageNumber) {
    const { pdfFilePath } = this;
    const outputImagePath = this.getOutputImagePathForPage(pageNumber);
    const convertCommand = this.constructConvertCommandForPage(pageNumber);

    const promise = new Promise((resolve, reject) => {
      function convertPageToImage() {
        exec(convertCommand, (err, stdout, stderr) => {
          if (err) {
            return reject({
              message: 'Failed to convert page to image',
              error: err,
              stdout,
              stderr,
            });
          }
          return resolve(outputImagePath);
        });
      }

      fs.stat(outputImagePath, (err, imageFileStat) => {
        const imageNotExists = err && err.code === 'ENOENT';
        if (!imageNotExists && err) {
          return reject({
            message: 'Failed to stat image file',
            error: err,
          });
        }

        // convert when (1) image doesn't exits or (2) image exists
        // but its timestamp is older than pdf's one

        if (imageNotExists) {
          // (1)
          convertPageToImage();
          return null;
        }

        // image exist. check timestamp.
        fs.stat(pdfFilePath, (error, pdfFileStat) => {
          if (err) {
            return reject({
              message: 'Failed to stat PDF file',
              error,
            });
          }

          if (imageFileStat.mtime < pdfFileStat.mtime) {
            // (2)
            convertPageToImage();
            return null;
          }

          return resolve(outputImagePath);
        });

        return null;
      });
    });
    return promise;
  },
};

exports.PDFImage = PDFImage;
