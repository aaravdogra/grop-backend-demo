import { ipcMain, dialog, shell } from "electron";
import fs from "fs";
import { Buffer } from "buffer";
import { add_directory, embed_files, get_directories, get_files_recursively, get_ignored_object } from "./filesystem";
import { embed_query } from "./embed";
import { query, clear, query_file } from './chroma';

export const setupAPI = () => {

    if (process.env.ENVIRONMENT == "dev") {
        clear(); //clear db in dev mode, in prod just don't delete files/dirs and it'll be fine
    }

    ipcMain.handle("prompt-dir", async (event, args) => {
        const open = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (open.canceled) {
            return {};
        }
        const filepath = open.filePaths[0];
        const dirs = await get_directories();
        if (dirs.includes(filepath)) {
            return {};
        }
        const filename = filepath.match(/[^/]+$/)[0];
        const ignoreObj = await get_ignored_object();
        const fps = await get_files_recursively(filepath, filepath, ignoreObj);
        const files = fps.map((filepath => {
            const stats = fs.statSync(filepath);
            console.log()
            return {
                "filepath": filepath,
                "name": filepath.match(/[^/]+$/)[0],
                "created": stats.birthtime,
                "modified": stats.mtime,
                "opened": stats.atime,
                "size": stats.size,
            }
        }));
        return {
            "filepath": filepath,
            "name": filename,
            "files": files,
        };
    });

    ipcMain.handle("process-new-dir", async (event, args) => {
        const req = args[0];
        try {
            const dir_path = req.filepath;
            await add_directory(dir_path);
            const ignoreObj = await get_ignored_object();
            const files = await get_files_recursively(dir_path, dir_path, ignoreObj);
            await embed_files(files, 'utf-8', dir_path);
        }
        catch (e) {
            console.log(e);
            return { "ok": false };
        }
        return { "ok": true };
    });

    ipcMain.handle("search-query", async (event, args) => {
        const req = args[0];
        try {
            const q = req.query;
            const dir = req.directory;
            const num_results = req.num_results;
            const embeddings = await embed_query(q);
            const result = await query(embeddings, num_results, {"directory": dir});
            const filepaths = result.metadatas[0].map((metadata) => {
                return metadata.filename;
            });

            const files = [];
            result.metadatas[0].forEach((metadata, i) => {
                if (files.some((file) => {
                    return file.filepath == metadata.filename;
                })) {
                    //append to existing file
                    const file = files.find((file) => {
                        return file.filepath == metadata.filename;
                    });
                    file.chunks.push(metadata.byte_num);
                } else {
                    //create new file
                    const filepath = metadata.filename;
                    const stats = fs.statSync(filepath);
                    files.push({
                        "filepath": filepath,
                        "name": filepath.match(/[^/]+$/)[0],
                        "created": stats.birthtime,
                        "modified": stats.mtime,
                        "opened": stats.atime,
                        "size": stats.size,
                        "chunks": [metadata.byte_num],
                        "distance": result.distances[0][i],
                        "text": metadata.documents,
                    });
                }
            });
            /*
                result = {
                    ids: [],
                    embeddings: null,
                    documents: [null],
                    metadatas: [ [{
                        timestamp: Date,
                        directory: string,
                        filename: string,
                        ocr: false,
                        byte_num: [start_byte, end_byte]
                    }]]
                }
            */
            return {
                "ok": true,
                "files": files,
            };
        }
        catch (e) {
            console.log(e);
            return { "ok": false, "files": [] };
        }
    });

    ipcMain.handle("get-directories", async (event, args) =>{
        const dirs = await get_directories();
        const ignoreObj = await get_ignored_object();
        const gropdirs = await Promise.all(dirs.map(async (filepath) => {
            const filename = filepath.match(/[^/]+$/)[0];
            const fps = await get_files_recursively(filepath, filepath, ignoreObj);
            const files = fps.map((filepath => {
                const stats = fs.statSync(filepath);
                console.log()
                return {
                    "filepath": filepath,
                    "name": filepath.match(/[^/]+$/)[0],
                    "created": stats.birthtime,
                    "modified": stats.mtime,
                    "opened": stats.atime,
                    "size": stats.size,
                }
            }));
            return {
                "filepath": filepath,
                "name": filename,
                "files": files,
            };
        }));

        return {
            "ok": true,
            "dirs": gropdirs,
        };
    })

    ipcMain.handle("open-file", async (event, args) =>{
        const req = args[0];
        const filepath = req.filepath;
        try {
            shell.openPath(filepath);
        } catch (e) {
            return {
                ok: false,
            }
        }
        return {
            ok: true,
        }
    });

    ipcMain.handle("get-related-files", async (event, args) => {
      const req = args[0];
      const filepath = req.filepath;
      const num_candidates = req.num_results;
      try {
        const files = await query_file(filepath, num_candidates);
        const ret = files.map((file) => {
          const path = file["file"];
          const distance = file["min_dist"];
          const stats = fs.statSync(path);
          return {
              "filepath": path,
              "name": path.match(/[^/]+$/)[0],
              "created": stats.birthtime,
              "modified": stats.mtime,
              "opened": stats.atime,
              "size": stats.size,
              "distance": distance
          }
        });
        return ret;
      } catch (e) {
        throw Error(`Could not query file ${filepath}!`);
      }
    })

}
