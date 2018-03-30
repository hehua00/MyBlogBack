var express=require("express")
var router=express.Router();
var  roleManager=require("../db/roleManager");
roleManager=new roleManager();

router.post('/list',function(req,res){

     var currentPage=req.body.page;
     var {sort,params,pageSize}=req.body;
     var query={};
     currentPage=(currentPage==null||currentPage<=0)?1:currentPage;

    if(params&&params.name){
        query['name']=new RegExp(params.name);
    }
    if(params&&params.tag){
        query['tag']=params.tag;
    }

     roleManager.page(currentPage, query, function(err,modules){
        res.send(modules);
    })
})


router.get('/single/:uuid',function(req,res){
    var uuid=req.params.uuid==null?0:req.params.uuid;
    roleManager.findByUUID(uuid,(err,module)=>{
        res.send(module);
    })
})

router.post('/save',function(req,res){
    let role=req.body;
    let {uuid}=role;
    if(uuid){
        roleManager.edit(uuid,role,(err)=>{
            res.send(err==null?"ok":err);
        })
    }else{
        roleManager.add(role,function(err){
            res.send(err==null?"ok":err);
        })
    }
})


router.get('/delete/:uuid',function(req,res){
    var uuid=req.params.uuid==null?0:req.params.uuid;
    roleManager.del(uuid,(err)=>{
        res.send(err==null?"ok":err);
    })
})

module.exports=router;