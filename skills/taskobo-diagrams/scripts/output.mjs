import {readFile,writeFile,mkdir,mkdtemp,rename,rm,readdir,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

async function inventory(root,prefix=''){
  const files=[];
  for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
    const name=prefix+entry.name,info=await lstat(path.join(root,name));
    if(info.isSymbolicLink())throw new Error('输出目录含符号链接，拒绝刷新：'+name);
    if(info.isDirectory()){const children=await inventory(root,name+'/');if(!children.length)throw new Error('输出目录含额外空目录：'+name);files.push(...children);}
    else if(info.isFile())files.push(name);
    else throw new Error('输出目录含不支持的文件：'+name);
  }
  return files.sort();
}
export async function verifyOutput(directory,{strict=false}={}){
  const root=path.resolve(directory);
  if((await lstat(root)).isSymbolicLink())throw new Error('输出目录不能是符号链接。');
  const report=JSON.parse(await readFile(path.join(root,'report.json'),'utf8'));
  if(report.schema!=='kobo.pm-render-report/v1'||!Object.keys(report.fileSHA256||{}).length)throw new Error('输出目录缺少有效的生成报告。');
  const actual=await inventory(root);
  for(const [name,expected]of Object.entries(report.fileSHA256)){
    const file=path.resolve(root,name);
    if(name==='report.json'||!file.startsWith(root+path.sep)||!/^[a-f0-9]{64}$/.test(expected)||sha(await readFile(file))!==expected)throw new Error('输出校验失败：'+name+'；保留手工修改后再使用新目录出图。');
  }
  if(strict&&JSON.stringify(actual)!==JSON.stringify([...Object.keys(report.fileSHA256),'report.json'].sort()))throw new Error('输出目录含报告外的文件，拒绝刷新；请保留文件或选择新目录。');
  return {directory:root,checkedFiles:Object.keys(report.fileSHA256).length,mode:report.mode,status:report.status||'complete',reportSHA256:sha(await readFile(path.join(root,'report.json')))};
}
export async function beginOutput(directory,{force=false,inputs=[]}={}){
  const out=path.resolve(directory);
  const canonical=value=>process.platform==='win32'?value.toLowerCase():value;
  const realOut=await realpath(out).catch(error=>{if(error.code!=='ENOENT')throw error;return out;});
  for(const value of inputs.filter(Boolean)){
    const input=canonical(await realpath(path.resolve(value)).catch(error=>{if(error.code!=='ENOENT')throw error;return path.resolve(value);})),target=canonical(realOut);
    if(input===target||input.startsWith(target+path.sep))throw new Error('输出目录不能包含项目或审阅输入。');
  }
  let previous=null,exists=false;
  try{await lstat(out);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(exists){if(!force)throw new Error('输出路径已经存在；使用 --force 刷新本工具生成且未修改的目录，或选择新目录。');previous=await verifyOutput(out,{strict:true});}
  await mkdir(path.dirname(out),{recursive:true});
  const stage=await mkdtemp(path.join(path.dirname(out),'.taskobo-render-'));
  const fileSHA256={};let retainStage=false;
  return {out,stage,
    async write(name,bytes){const file=path.resolve(stage,name);if(!file.startsWith(stage+path.sep))throw new Error('输出文件路径越界。');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});fileSHA256[name]=sha(bytes);},
    async commit(report){
      await writeFile(path.join(stage,'report.json'),JSON.stringify({...report,fileSHA256},null,2)+'\n',{flag:'wx'});
      retainStage=true;
      if(previous&&report.status!=='complete'){
        const failed=out+'.failed-'+path.basename(stage).slice('.taskobo-render-'.length);await rename(stage,failed);return failed;
      }
      if(previous){
        const checked=await verifyOutput(out,{strict:true});if(checked.reportSHA256!==previous.reportSHA256)throw new Error('输出目录在出图期间发生改变，拒绝刷新。新结果保存在 '+stage);
        const backup=stage+'-previous';await rename(out,backup);
        try{await rename(stage,out);}catch(error){await rename(backup,out);throw error;}
        // backup is this call's validated, generated-only directory beside stage.
        await rm(backup,{recursive:true,force:true,maxRetries:5,retryDelay:200});
      }else{
        let occupied=false;try{await lstat(out);occupied=true;}catch(error){if(error.code!=='ENOENT')throw error;}
        if(occupied)throw new Error('输出路径在出图期间被创建，拒绝覆盖。');
        await rename(stage,out);
      }
      return out;
    },
    async abort(){if(!retainStage&&stage.startsWith(path.dirname(out)+path.sep+'.taskobo-render-'))await rm(stage,{recursive:true,force:true});}
  };
}
