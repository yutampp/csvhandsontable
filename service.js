const fsps = require("fs/promises");
const fs = require("fs");
const { parse } = require("csv-parse/sync");

module.exports = class Service {
  constructor(filename,headerfile){
    this.header;
    this.visualHeader;
    this.readHeader(headerfile);
    this.data = [];
    this.state = "init";
    this.readFile(filename);
    this.group ;
    this.cache = [];
    this.max_cache = 100;
  }

  readHeader(filename){
    fsps.readFile(filename,"utf8").then(data=>{
      this.header = parse(data).map((v,i)=>[...v,i] );
      console.log(this.header);
      this.visualHeader = this.header.filter(v=>v[1]!=="");
      this.visualHeader.sort((a,b)=>{
        const aa = parseInt(a[1]);
        const bb = parseInt(b[1]);
        if(aa<bb) return -1
        if(aa>bb) return 1
        return 0
      })
      console.log(this.visualHeader);
    });
  }

  readFile(filename){
    let array;
    let temp = "";
    const stream = fs.createReadStream(filename,{encoding:"utf8",highWaterMark:64*1024} );
    stream.on("open", ()=>{
      this.state = "open";
      console.time("stream");
    });
    stream.on("data", chunk => {
      chunk = temp + chunk;
      array = chunk.split("\r\n");
      temp = array.pop();
      this.data.push(...array);
      console.log(process.memoryUsage().heapTotal/1000000);
    });
    stream.on("close", ()=>{
      this.state = "close";
      console.timeLog("stream");
      this.data = this.data.map(v=>{
        const vv = v.split(",").map(v=>v.replaceAll('"',""));
        const result = new Array(this.visualHeader.length).fill(null).map((r,i)=>{
          const col = this.visualHeader[i][2];
          return vv[col]
        });
        return result
      } );
      console.log(this.data.length );
      console.timeLog("stream" );
      setInterval(()=>console.log(process.memoryUsage().heapTotal/1000000) ,5000 );
    });
  }


  getData(){
    return new Promise(resolve => {
      setInterval(()=>{
        if(this.state="close"){
          resolve(this.data);
        }
      },500)
    })
  }
  getHeader(){
    return this.visualHeader.map(v=>v[0])
  }

  findCache(query){
    let hit_index;
    let result;
    const isExist = this.cache.some((v,i)=>{
      const exp = JSON.stringify(v.query) == JSON.stringify(query);
      if(exp) hit_index=i;
      return exp;
    });
    if(isExist){
      result = this.cache.splice(hit_index, 1);
      this.cache.push(...result);
    }else{
      return false
    }
    return result[0];
  }
  setCache(query, result){
    if(this.state!=="close") return false
    this.cache.push({query:query,result:result});
    console.log("set_cache",query);
    if(this.cache.length> this.max_cache){
      const temp = this.cache.shift();
      console.log("delete_cache",temp.query);
    }
  }
}





