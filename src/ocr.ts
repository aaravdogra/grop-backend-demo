import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import Tesseract from 'tesseract.js';
import { createCanvas, loadImage } from 'canvas';
import { Configuration, OpenAIApi } from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

const removeEmptyLines = str => str.split(/\r?\n/).filter(line => line.trim() !== '').join('\n');

async function performOcr(pageText) {
    try {
        const result = await Tesseract.recognize(pageText, 'eng', { logger: m => (void (0)) });
        const text = result.data.text;
        return text;
    } catch (e) {
        console.log(e);
    }
}

async function filterText(text) {
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    try {
        const filtered = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
            {role: "system", content: `You are an text editor who only outputs meaningful English text. If a word
            does not exist in the English dictionary, UNDER NO CIRCUMSTANCES output it. You shall be greatly penalized
            for doing so. However, if its close to an actual english word, you may interpolate. If you are uncertain about 
            a line of text or it looks close to gibberish, but you still choose to output it, you must put " uncertain" at 
            the end of that line`},
            {role: "user", content: `Given the following English text, remove any nonsensical 
            English strings that do not exist in a standard dictionary, interpolating optionally only if you're certain about 
            some words that might be slightly misspelled, but make sense 
            in context. Keep words that are clearly English, even 
            if they don't necessarily make sense in context. Do not return
            anything except the edited text, so do not explain
            the rationale behind any decisions you make. 
    
            text: ${text}`},
            ],
            temperature: 0.1,
        });
        let filteredText = filtered.data.choices[0].message.content;
        let splitLines = filteredText.split('\n');
        let filteredTextArray = splitLines.map(line => {
            let lower = line.toLowerCase();
            if (lower.includes("uncertain") || lower.includes("sorry") || line.includes("nonsensical") || line.includes("english"))
                return '';
            else
                return line;
        });
        filteredText = filteredTextArray.join('\n');
        return removeEmptyLines(filteredText);
    } catch (e) {
        console.log(e);
    }
}

export const parsePdf = async (pdfPath: string) => {
    const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
    const pdfDocument = await getDocument({ data: pdfData }).promise;
    const numPages = pdfDocument.numPages;
    const pages = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join('');
        if (text.length == 0) {
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = createCanvas(viewport.width, viewport.height);
            const canvasContext = canvas.getContext('2d');
            await page.render({ canvasContext, viewport }).promise;
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync('canvas.png', buffer);
            const text_ocr = await performOcr('canvas.png');
            const filtered_text = await filterText(text_ocr);
            pages.push(filtered_text);
        } else {
            pages.push(text);
        }
    }

    return pages;
}