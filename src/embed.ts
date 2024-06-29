import cohere from './main'
import fs from 'fs';
import * as fspromises from 'fs/promises';
import path from 'path';
import { Chunk } from 'webpack';
import { generate_uids } from './chroma';
import { convert } from 'html-to-text';
import {marked} from 'marked';
import { parsePdf } from './ocr';

const MODEL_SIZE = 'large';
const CHUNK_SIZE = 1000;

export type EmbeddingMetaData = {
  filename: string,
  directory: string,
  ocr: boolean,
  byte_num: number[],
  timestamp: Date,
}

export type EmbeddingContent = {
  sentences: string[],
  embeddings: number[][],
  uids?: string[],
  metadatas?: EmbeddingMetaData[],
  documents?: string[],
}

export const embed_query = async (query: string): Promise<number[]> => {
  const embedding_response = await cohere.embed({
    texts: [query],
    model: MODEL_SIZE
  });
  return embedding_response.body.embeddings[0];
}

export const embed_txt = async (filepath: string, enc: BufferEncoding, indexedDir: string): Promise<EmbeddingContent> => {

  //   const filepath = path.resolve(__dirname, filename);
  try {
    // const data = await fs.readFile(filepath, enc);
    var sentences = [];
    const fh = await fspromises.open(filepath, 'r');
    const stats = await fspromises.stat(filepath);
    let buffer = await fspromises.readFile(filepath);
    await fh.close();

    var cur = 0;
    let byte_counts = [];
    while (cur < buffer.length){
        const size = Math.min(CHUNK_SIZE, buffer.length - cur)
        sentences.push(buffer.subarray(cur, cur + size).toString(enc));
        byte_counts.push([cur, cur+  size]);
        cur +=  size;
    }
    const name = filepath.substring(filepath.lastIndexOf("/"));
    const dir = filepath.substring(0, filepath.lastIndexOf("/"));
    const embedding_response = await cohere.embed({ texts: sentences, model: MODEL_SIZE });
    const ids = await generate_uids({ sentences: sentences, embeddings: embedding_response.body.embeddings });
    let total_metadata = [];
    var total_string = buffer.toString(enc);
    for (var i = 0; i < sentences.length; i++) {
      total_metadata.push({ timestamp: stats.mtime, directory: indexedDir, filename: filepath, ocr: false, byte_num: byte_counts[i], documents: total_string });
    }
    return { uids: ids, sentences: sentences, embeddings: embedding_response.body.embeddings,  metadatas: total_metadata };

    // TODO:
    // change split parameters for txt

  } catch (e) {
    throw Error(`Error Reading File: ${filepath}. ${e}`);
  }

}

export const embed_html = async (filepath: string, enc: BufferEncoding, indexedDir: string): Promise<EmbeddingContent> => {
    try{
        var sentences = [];
        const fh = await fspromises.open(filepath, 'r');
        const stats = await fspromises.stat(filepath);
        let buf = await fspromises.readFile(filepath);
        await fh.close();

        let html_text = buf.toString(enc);
        const text = convert(html_text, {});
        const buffer = Buffer.from(text);

        var cur = 0;
        let byte_counts = [];
        while (cur < buffer.length){
            const size = Math.min(CHUNK_SIZE, buffer.length - cur)
            sentences.push(buffer.subarray(cur, cur + size).toString(enc));
            byte_counts.push([cur, cur+  size]);
            cur +=  size;
        }
        const embedding_response = await cohere.embed({texts: sentences, model:MODEL_SIZE});
        const ids = await generate_uids({sentences: sentences, embeddings: embedding_response.body.embeddings});
        let total_metadata = [];
        for(var i = 0; i<sentences.length; i++){
            total_metadata.push({timestamp: stats.mtime, directory: indexedDir, filename: filepath, ocr: false, byte_num: byte_counts[i], documents: text })
        }
        return {uids: ids, sentences: sentences, embeddings: embedding_response.body.embeddings,  metadatas: total_metadata};

    }
    catch (e) {
        throw Error(`Error Reading File: ${filepath}. ${e}`);
    }

}

export const embed_md = async (filepath: string, enc: BufferEncoding, indexedDir: string): Promise<EmbeddingContent> => {
    try{
        var sentences = [];
        const fh = await fspromises.open(filepath, 'r');
        const stats = await fspromises.stat(filepath);
        let buf = await fspromises.readFile(filepath);
        await fh.close();

        let md_text = buf.toString(enc);
        let html_text = marked.parse(md_text);
        const text = convert(html_text, {});
        const buffer = Buffer.from(text);

        var cur = 0;
        let byte_counts = [];
        while (cur < buffer.length){
            const size = Math.min(CHUNK_SIZE, buffer.length - cur)
            sentences.push(buffer.subarray(cur, cur + size).toString(enc));
            byte_counts.push([cur, cur+  size]);
            cur +=  size;
        }
        const embedding_response = await cohere.embed({texts: sentences, model:MODEL_SIZE});
        const ids = await generate_uids({sentences: sentences, embeddings: embedding_response.body.embeddings});
        let total_metadata = [];
        for(var i = 0; i<sentences.length; i++){
            total_metadata.push({timestamp: stats.mtime, directory: indexedDir, filename: filepath, ocr: false, byte_num: byte_counts[i], documents: text })
        }
        return {uids: ids, sentences: sentences, embeddings: embedding_response.body.embeddings, metadatas: total_metadata};

    }
    catch (e) {
        throw Error(`Error Reading File: ${filepath}. ${e}`);
    }

}


export const embed_pdf = async (filepath: string, enc: BufferEncoding, indexedDir: string): Promise<EmbeddingContent> => {
  //TODO:
  // implement OCR/pdf parsing
  try {
      const stats = await fspromises.stat(filepath);
      const pages = await parsePdf(filepath);
      let total_string = "";
      for (var i = 0; i < pages.length; i++) {
        total_string += pages[i];
      }
      let buffer = Buffer.from(total_string);
      var cur = 0;
      let sentences = [];
      let byte_counts = [];
      while (cur < buffer.length) {
        const size = Math.min(CHUNK_SIZE, buffer.length - cur)
        sentences.push(buffer.subarray(cur, cur + size).toString(enc));
        byte_counts.push([cur, cur + size]);
        cur += size;
      }
      const embedding_response = await cohere.embed({ texts: sentences, model: MODEL_SIZE });
      const ids = await generate_uids({ sentences: sentences, embeddings: embedding_response.body.embeddings });
      let total_metadata = [];
      for (var i = 0; i < sentences.length; i++) {
        total_metadata.push({ timestamp: stats.mtime, directory: indexedDir, filename: filepath, ocr: true, byte_num: byte_counts[i], documents: total_string })
      }
      console.log(total_string);
      return { uids: ids, sentences: sentences, embeddings: embedding_response.body.embeddings, metadatas: total_metadata };
  }
  catch (e) {
    throw Error(`Error Reading File: ${filepath}. ${e}`);
  }

}

//images?
