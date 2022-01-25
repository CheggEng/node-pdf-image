import { PDFImage } from './index';

// $ExpectType PDFImage<false>
new PDFImage("path");

// $ExpectType Promise<string[]>
new PDFImage("path").convertFile();

// $ExpectType Promise<string>
new PDFImage("path", { combinedImage: true }).convertFile();

// $ExpectType Promise<string | string[]>
new PDFImage<boolean>("path", { combinedImage: true }).convertFile();

new PDFImage("path", { convertOptions: { "-adaptive-blur": "" } });
