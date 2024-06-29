import * as dotenv from 'dotenv'
import cohere from 'cohere-ai';
import {ChromaClient} from 'chromadb';
import crypto from 'crypto';
import { EmbeddingContent } from './embed';
import { GetEmbeddingIncludeEnum, QueryEmbeddingIncludeEnum } from 'chromadb/dist/main/generated/index.js';

const client = new ChromaClient();
const HASH_FUNCTION = 'sha256';
const SECRET = 'secret'; //TODO: update to use env

/* {
    id: arbritray ID
    embeddings:
    metadta: {ocr: bool, filename: str, byte_loc: array, directory: str}
    documents: null
}
*/

// TODO:
// make add operations idempotent, add indexing

export const clear = async () => {
    await client.reset();
    return true;
}

export const peek = async () => {
    const collection = await client.getOrCreateCollection("embedding_collection", {});
    const res = await collection.peek();
    return res;
}

export const query = async (embeddings: number[] | number[][], num_cands: number, filters: Object) =>{
    const collection = await client.getOrCreateCollection("embedding_collection", {});
    const num_entries = await collection.count();
    num_cands = Math.min(num_cands, num_entries);
    const query = await collection.query(embeddings, num_cands, filters);
    return query;
};

export const add = async (embedding: EmbeddingContent ) => {
    const collection = await client.getOrCreateCollection("embedding_collection", {});
    const result = await collection.add(embedding.uids, embedding.embeddings, embedding.metadatas);
    return result;
};

export const del = async (uid: string[]) => {
    const collection = await client.getOrCreateCollection("embedding_collection", {});
    const result = await collection.delete(uid);
    return result;
};

export const del_dir = async (dir_name: string) => {
    const collection = await client.getOrCreateCollection("embedding_collection", {});
    const result = await collection.delete(undefined, {"directory": dir_name});
    return result;
};

//TODO: generate UUID for vectors
// https://www.geeksforgeeks.org/node-js-crypto-createhash-method/#

export const generate_uids = (embeddingObj: EmbeddingContent): string[] => {
  const hashes = embeddingObj.embeddings.map((embedding, i) => {
    const hash_func = crypto.createHash(HASH_FUNCTION);
    return hash_func.update(embeddingObj.sentences[i], 'utf-8').digest('hex');
  })
  return hashes;
}

// returns list of absolute filepaths of files related to filePath
export const query_file = async (filePath: string, numCandidates: number) => {

  const NUM_SIMILAR_EMBEDDINGS = 20;
  const collection = await client.getOrCreateCollection('embedding_collection', {});
  const num_embeddings = await collection.count();
  const embeddings_obj = await collection.get(undefined, {filename: filePath}, undefined, undefined, [GetEmbeddingIncludeEnum.Embeddings, GetEmbeddingIncludeEnum.Metadatas]);
  const result = await collection.query(embeddings_obj.embeddings, Math.min(NUM_SIMILAR_EMBEDDINGS, num_embeddings), undefined, undefined, undefined, [QueryEmbeddingIncludeEnum.Metadatas, QueryEmbeddingIncludeEnum.Distances]);
  const totalDistances = {};
  console.log(result);

  result.metadatas.forEach((metadata, i) => {
    metadata.forEach((data_obj, j) => {
      const file = data_obj.filename;
      if(totalDistances[file] == undefined) {
        totalDistances[file] = {min_dist: Number.MAX_SAFE_INTEGER};
      }
      totalDistances[file].min_dist =  Math.min(totalDistances[file].min_dist, result.distances[i][j])
    })
  });

   let distances_array = Object.keys(totalDistances).map((key) => {
    let ret = {};
    ret["file"] = key;
    ret["min_dist"] = totalDistances[key]["min_dist"];
    return ret;
  });
  distances_array = distances_array.sort((a, b) => {
    return a["avgDistance"] - b["avgDistance"];
  });

  return distances_array.filter((objects) => {
    return objects["file"] !== filePath;
  }).slice(0, Math.min(distances_array.length, numCandidates));

}
