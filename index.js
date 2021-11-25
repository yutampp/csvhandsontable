const express = require('express');
const bodyParser = require('body-parser');
const Service = require("./service.js");
const app = express();
const port = 80;
process.chdir(__dirname + "/");

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
  res.send(service.getHeader() );
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
      const aa = isNaN(a[sort])?a[sort]:parseInt(a[sort]);
      const bb = isNaN(b[sort])?b[sort]:parseInt(b[sort]);
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
