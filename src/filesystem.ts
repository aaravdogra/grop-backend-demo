// serialization and storage of directories we're interested in
// periodically scanning directories for file change
// updating and delete embeddings based on changes in files
import fs from 'fs/promises';
import * as fs_reg from 'fs';
import path from 'path';
import { embed_pdf, embed_txt, embed_html, embed_md } from './embed';
import { add, generate_uids, peek } from './chroma';
import directoryTree from 'directory-tree';

const directories_filepath = path.resolve(__dirname, '../../userData/directories.json');
const ignore_filepath = path.resolve(__dirname, '../../userData/ignore.json');
const tree_filepath = path.resolve(__dirname, "../../userData/tree.json");
const MAX_DEPTH = 10;

export const get_directories = async (): Promise<string[]> => {

  try {
    const data = await fs.readFile(directories_filepath, 'utf-8');
    const json = JSON.parse(data);
    return json.directories;
  } catch (e) {
    console.log(e);
    throw Error (`Could not read file ${directories_filepath}!`);
  }
}

export const get_ignored_object = async (): Promise<Object> => {
  try {
    const data = await fs.readFile(ignore_filepath, 'utf-8');
    const json = JSON.parse(data);
    return json;
  } catch (e) {
    console.log(e);
    throw Error (`Could not read file ${directories_filepath}!`);
  }
}

export const get_tree = async () => {
  try {
    const data = await fs.readFile(tree_filepath, 'utf-8');
    const json = JSON.parse(data);
    return json;
  } catch (e) {
    console.log(e);
    throw Error (`Could not read file ${tree_filepath}!`);
  }
}


const create_tree = (dir, ignoreObj) => {
  const ignore_hidden = ignoreObj.global.ignore_hidden || ignoreObj.per_directory?.[dir].ignore_hidden;
  const ignore_hidden_regexp = ignore_hidden ? [new RegExp(".*/\\..*")]: [];
  const global_file_regexp = ignoreObj.global.files.map((file) => {
    return new RegExp(`${file}$`, "i");
  });
  const global_dir_regexp = ignoreObj.global.directories.map((dir) => {
    return new RegExp(`^.*/${dir}`, "i");
  });
  const dir_file_regexp = ignoreObj.per_directory?.[dir].files.map((file) => {
    return new RegExp(`${file}$`, "i");
  });
  const dir_dir_regexp = ignoreObj.per_directory?.[dir].directories.map((dir) => {
    return new RegExp(`^.*/${dir}`, "i");
  })
  const regexp_arr = global_file_regexp.concat(ignore_hidden_regexp, global_dir_regexp, dir_file_regexp, dir_dir_regexp);
  return directoryTree(dir, {attributes:['mtime'], exclude: regexp_arr});
}

const createIgnore = (ignore: boolean, ignoreFiles: string[], ignoreDirectories: []) => {
  return {
    ignoreHidden: ignore,
    directories: ignoreDirectories,
    files: ignoreFiles
  }
}

const updateIgnore = async (dirName: string, ignoreOptions) => {
  try {
    let ignoreObj = await get_ignored_object();
    let tree = await get_tree();
    ignoreObj["per_directory"][dirName] = ignoreOptions;
    let tree_for_directory = create_tree(dirName, ignoreObj);
    tree[dirName] = tree_for_directory;
    try {
      await fs.writeFile(tree_filepath, JSON.stringify(tree, null, 2), 'utf-8');
      await fs.writeFile(ignore_filepath, JSON.stringify(ignoreObj, null, 2), 'utf-8');
    } catch (e) {
      console.log(e);
      throw new Error(`Could not write to tree or ignore config!`);
    }
  } catch (e) {
    console.log(e);
    throw new Error(`Could not get ignore or tree object!`);
  }
}

export const add_directory = async (dir: string) => {
  try {
    let dirs = await get_directories();
    let tree = await get_tree();
    dirs.push(dir);
    dirs = [...new Set(dirs)];
    let json_string = JSON.stringify({directories: dirs}, null, 2);

    let newIgnore = createIgnore(false, [], []);
    let ignoreObj = await get_ignored_object();
    ignoreObj["per_directory"][dir] = newIgnore;
    let tree_for_directory = create_tree(dir, ignoreObj);
    tree[dir] = tree_for_directory;

    try {
      await fs.writeFile(directories_filepath, json_string, 'utf-8');
      await fs.writeFile(tree_filepath, JSON.stringify(tree, null, 2), 'utf-8');
      await fs.writeFile(ignore_filepath, JSON.stringify(ignoreObj, null, 2), 'utf-8');
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

//TODO: update tree.json and ignore.json on remove
export const remove_directory = async (dir: string) => {
  try {
    let dirs = await get_directories();
    let set_dirs = new Set(dirs);
    if(!set_dirs.delete(dir))
      return false;
    dirs = [...set_dirs];
    let json_string = JSON.stringify({directories: dirs}, null, 2);
    try {
      await fs.writeFile(directories_filepath, json_string, 'utf-8');
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }

}


//returns filesystem removed directories
export const remove_old_directories = async (): Promise<string[]> => {
  try {
    let dirs = await get_directories();

    let new_dirs = dirs.filter((dir) => {
      return fs_reg.existsSync(dir);
    });
    let removed_dirs = dirs.filter((dir) => {
      return !fs_reg.existsSync(dir);
    });

    try {
      removed_dirs.forEach(async (dir) => {
        await remove_directory(dir);
      });
      return removed_dirs;
    } catch (e) {
      throw Error (`Could not write to ${directories_filepath}`);
    }

  } catch (e) {
    console.log(e);
    throw Error (`Could not get list of directories from ${directories_filepath}`);
  }
  return []

}

// walk directories and return files (must be valid directory)
// ignores hidden files/directories by default
// max recursion depth = MAX_DEPTH
export const get_files_recursively = async (root: string, dir=root, ignoreObject, depth=0) => {
  if (depth > MAX_DEPTH)
    return [];
  let files = await fs.readdir(dir);
  //FIlTER
  const dir_meets_filter = (path) => {
    if(path.length === 1)
      return true;
    const dirName = path.substring(path.lastIndexOf('/')+1);
    const parentName = Object.keys(ignoreObject.per_directory).find((element) => {return path.indexOf(element) === 0;})
    if( dirName.charAt(0) === '.' && (ignoreObject.global.ignore_hidden || (ignoreObject.per_directory?.[parentName] && ignoreObject.per_directory?.[parentName].ignore_hidden))) {
      return false;
    }
    if (ignoreObject.global.directories.includes(dirName) || (ignoreObject.per_directory?.[parentName] && ignoreObject.per_directory?.[parentName].directories.includes(dirName))) {
      return false;
    }
    return true;
  }

  const file_meets_filter = (path) => {
    const fileName = path.substring(path.lastIndexOf('/') + 1);
    const parentName = Object.keys(ignoreObject.per_directory).find((element) => {return path.indexOf(element) === 0;})
    if( fileName.charAt(0) === '.' && (ignoreObject.global.ignore_hidden || (ignoreObject.per_directory?.[parentName] && ignoreObject.per_directory?.[parentName].ignore_hidden))) {
      return false;
    }
    if (ignoreObject.global.files.includes(fileName) || (ignoreObject.per_directory?.[parentName] && ignoreObject.per_directory?.[parentName].files.includes(fileName))) {
      return false;
    }
    return true;
  }

  let all_files = await Promise.all(files.map(async file => {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory() && dir_meets_filter(filePath)) return get_files_recursively(root, filePath, ignoreObject, depth+1);
      else if(stats.isFile() && file_meets_filter(filePath)) return filePath;
      else return []
  }));

  return all_files.reduce((all, folderContents) => all.concat(folderContents), []);
}

export const embed_files = async (files: string[], enc: BufferEncoding, indexedDir: string) => {
  // TODO:
  // chose embedding method to use depending on encoding and OCR
  files.forEach(async (file) => {
    let extension = "";
    let fileName = file.substring(file.lastIndexOf('/') + 1);
    if(fileName[0] != '.') {
      let index = fileName.lastIndexOf('.');
      if(index !== -1)
        extension = fileName.substring(fileName.lastIndexOf('.'));
    }
    let embedding_function = embed_txt;
    switch (extension) {
      case ".pdf":
        embedding_function = embed_pdf;
        break;
      case ".md":
        embedding_function = embed_md;
        break;
      case ".html":
        embedding_function = embed_html;
        break;
    }
    const embedding = await embedding_function(file, enc, indexedDir);
    const ids = generate_uids(embedding);
    embedding.uids = ids;
    add(embedding);
  })
}

// TODO:
// BROKEN
//assume top level directories are all present, can filter out with remove_old_directories
export const folder_diffs = async () => {
  const directories = await get_directories();
  const ignoreObj = await get_ignored_object();
  const old_json = await get_tree();
  directories.forEach(async (dir) => {
    const old_tree = old_json[dir];
    const new_tree = await create_tree(dir, ignoreObj);
    //traverse old tree, if node doesnt exist in new tree, deletion
    //if modification time is different, its been modified, (can delete fro old tree)
    //traverse new tree, if its not old in tree, its an add
    const deleted_nodes = traverse_tree(old_tree, new_tree, true);
    const added_nodes = traverse_tree(new_tree, old_tree, false);
  })
}
// TODO:
// BROKEN
export const traverse_tree = (tree, other_tree, check_modification) => {
  let different_nodes = [];

  //tree no children, other no children, both no children, both children

  //if tree has no children, if other has no children, case is handled by previous clal
  //if tree has children, if other has no children, take children and put into nodes
  // if tree has no children, if other has children, do nothing
  // if tree has children, other has children, see below

  if(tree == undefined || other_tree == undefined || tree.children == undefined) {
    return [];
  }

  if(tree.children.length !==0 && other_tree.children.length == undefined) {
    Object.keys(tree.children).forEach((key) => {
      different_nodes.push(tree.children[key]['path']);
      different_nodes.concat(traverse_tree(tree.children[key]['children'], other_tree, check_modification));
    })
  }
  let to_be_deleted = [];
  (tree.children ?? []).forEach((otherChild) => {
    let contains = false;
    (other_tree.children ?? []).forEach((origChild, i) => {
      if(otherChild['path']===origChild['path']) {
        contains = true;
        if(check_modification && JSON.stringify(otherChild['mtime']) + "" !== JSON.stringify(origChild['mtime'])) {
          to_be_deleted.push(origChild['path']);
        } else {
          const new_list = traverse_tree(otherChild, origChild, check_modification);
          different_nodes = different_nodes.concat(new_list);
        }
      }
    });
    if(!contains) {
      different_nodes.push(otherChild['path']);
    }
  });
  if(to_be_deleted.length !== 0 && tree.children != undefined) {
    tree.children = tree.children.filter((child) => {
      return !to_be_deleted.includes(child['path']);
    });
  }
  return different_nodes;
}


export const test_tree = async () => {
  const success = await add_directory('/Users/aarav/projects/cohere_test');
  const success2 = (await add_directory('/Users/aarav/projects/lahacks2023/src'));
  if(success && success2) {
    console.log("success");
  } else {
    console.log("error");
  }
}

export const test_traversal = async () => {
  const tree = await get_tree();
  let tree1 = tree["/Users/aarav/projects/lahacks2023/src"];
  let ignoreObj = await get_ignored_object();
  let tree2 = await create_tree("/Users/aarav/projects/lahacks2023/src", ignoreObj);

  console.log("first traversal: ", traverse_tree(tree1, tree2, true));
  console.log("old tree: ", tree1);
  console.log("new tree: ", tree2);
  console.log("second traversal: ", traverse_tree(tree2, tree1, false));
}
