const express = require('express');
const bodyParser = require('body-parser');
const fsps = require("fs/promises");
const fs = require("fs");
const app = express();
const port = 80;
process.chdir(__dirname + "/");

class Service {
  constructor(filename,headerfile){
    this.header;
    this.readHeader(headerfile);
    this.data = [];
    this.state = "init";
    this.readFile(filename);
    this.group ;
    this.cache = [];
    this.max_cache = 100;
  }

  readHeader(filename){
    fsps.readFile(filename,"utf8").then(data=>this.header=data.split("\n") )
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
      this.data = this.data.map(v=>v.split(",").map(v=>v.replaceAll('"',"")) );
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











const service = new Service("COSMS003.TXT","header.csv");

app.use("/html", express.static("html"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}) );

app.get("/test/", async (req,res) =>{
  const data = await service.getData();
  console.log(data.length);
  res.send( data.slice(0,40) );
})

app.get("/test/:id/", async (req,res) =>{
  const id = req.params.id;
  const data = await service.getData();
  res.send(data[id])
})

app.get("/header/", async (req,res) => {
  res.send(service.header);
});

app.post("/query/", async (req,res) => {
  console.log(req.body);
  console.time("query");
  let { query, sort, size, page, session } = req.body;
  page = page ?? 0;
  size = size ?? 40;
  const hit_cache = service.findCache(query);
  const data = await service.getData();
  let result
  if(!hit_cache){
    result = query.reduce( (acc,q) => {
      if(q[1].length==0) return acc
      const reg = new RegExp(q[1]);
      const key = ''===q[0] ? 3 : q[0];
      return acc.filter(v=>reg.test(v[key]) );
    }, data);
    service.setCache(query,result);
  }else{
    result = hit_cache.result;
  }
  const count = result.length;
  console.log(size * page, size * page + size);
  console.timeLog("query");
  if(sort!=="dummy" && count < 100000){
    result.sort((a,b)=>{
      const aa = a[sort];
      const bb = b[sort];
      if(aa < bb ) return -1
      if(aa > bb ) return 1
      if(aa == bb ) return 0
    });
  }
  const records = result.slice(size * page, parseInt(size * page) + parseInt(size));
  res.send({
    records: records,
    count: count,
    page: page,
    session: session,
  });
  console.timeEnd("query");
})

app.listen(port, () => {
  console.log("listen: " + port );
} )


/*
request {
  query: [ [key1,value2]  ,[key2,value2]... ]
  sort: [key, true|false(ACS|DESC)]
  size: number
  page: number
  session: string
 }
response {
  records:[ [row1] , [row2]… ]
  count: number
  page: number
  session: string
}
*/
