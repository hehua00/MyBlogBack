var express = require("express")
var router = express.Router();
var fetch = require("../util/fetch");
var moment = require("moment");
var wx = require("../config").wx;
var {userManager} = require("../db/modelManager");
var articleQuery = require("../query/articleQuery");
var channelQuery = require("../query/channelQuery");
var commentQuery = require("../query/commentQuery");
var zanQuery = require("../query/zanQuery");
var tokenUtil=require("../security/token")

userManager = new userManager();
var appId = wx.appId;
var secret = wx.secret;

router.get('/login/:code', function (req, res) {
    var code = req.params.code;
    fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`, req).then(function (resp, err) {
        // res.send(resp);
        var data = resp.data.data;

        res.send(data);
    });
})

//用户是否注册过
router.get('/exist/:tid', function (req, res) {
    var tid = req.params.tid;
    console.log("tid:" + tid);
    userManager.find({tid: tid}, function (err, models) {
        if (models.length) {
            //创建token
            let tokenStr=createUserToken(models[0].uuid);
            res.send(tokenStr);
        } else {
            res.send(false);
        }
    })
});

//微信注册登录
router.post('/wxRegister', function (req, res) {
    var user = req.body;
    userManager.add(user, function (err,module) {
        //创建token
        let tokenStr=createUserToken(module.uuid);
        // res.send(tokenStr);
        res.send(err == null ? tokenStr: err);
    })
});

function createUserToken(userId){
    let tokenStr=tokenUtil.createToken({
        userId
    },Date.now()/1000+24*3600);
    console.log("生成token成功");
    return tokenStr;
}

//更新登录时间等信息
router.get('/updateInfo/:tid', function (req, res) {
    var tid = req.params.tid;
    userManager.find({tid: tid}, function (err, users) {
        if (users.length) {
            //更新用户信息
            var user = users[0];
            user.loginTime = moment().format("YYYY-MM-DD HH:mm:ss");
            userManager.edit(user.uuid, user, function (err) {
                res.send(err == null ? true : err);
            })
        } else {
            res.send(true);
        }
    })
});

//wx 获取文章列表
router.post('/blogList', function (req, res) {
    var currentPage = req.body.page;
    var params = req.body.params;
    currentPage = (currentPage == null || currentPage <= 0) ? 1 : currentPage;
    var query = {};
    if (params && params.title) {
        query['title'] = new RegExp(params.title);
    }
    if (params && params.tag) {
        query['tag'] = params.tag;
    }
    //排行榜排序字段
    let sort={};
    if (params && params.search_field) {
        sort[ params.search_field] =-1;
    }
    async function getArticleList() {
        let info = await  articleQuery.articleListPromise(currentPage, query,sort);
        //普通模式下 不需要在排序评论信息的 直接返回以节省性能
        if(params.search_field==null||params.search_field!="cv"){

            for (let module of info.models) {
                let count = await commentQuery.getCommentCount(module.uuid)
                module['commentSize'] = count;
            }

            console.log("最快模式...");



            return info;
        }else{
            //按评论量排序
            let allModules = await articleQuery.articleListAllPromise(query,sort);
            info.models=allModules;
            for (let module of info.models) {
                let count = await commentQuery.getCommentCount(module.uuid)
                module['commentSize'] = count;
            }
            //按评论量排序
            info.models.sort((a,b)=>{
                return b.commentSize-a.commentSize;
            })
            //内存分页
            let pageSize=info.pageSize;
            let start=pageSize*(currentPage-1);
            let end=currentPage*pageSize;
            end=end>info.total?info.total:end;
            info.models=info.models.slice(start,end);
            console.log("内存分页模式...");
            return info;
        }

    }
    getArticleList().then((info)=>{
        res.send(info);
    }).catch((err)=>{
        console.log(err);
        res.send(err);
    })
});
//wx 获取单个文章
router.get('/blogSingle/:uuid', function (req, res) {
    var uuid = req.params.uuid == null ? 0 : req.params.uuid;
    async function getSingle(uuid) {
        let blog = await articleQuery.findByUUIDPromise(uuid);
        let channel = await channelQuery.getChannelPromise(blog.tag);
        //增加pv
        let pv = blog.pv == null ? 0 : blog.pv;
        blog.pv = parseInt(pv) + 1;
        await articleQuery.savePromise(uuid, blog)
        blog["channelName"] = channel.name;
        var json = {
            module: blog
        }
        return json;
    }
    getSingle(uuid).then((json) => {
        res.send(json);
    })
})


router.post('/getZan',function (req,res) {
    var {token,blogId} = req.body;
    let userId=tokenUtil.getByKey(token,"userId");
    if(userId){
        zanQuery.isZanPromise(userId,blogId).then((isZan)=>{
            res.send(isZan)
        }).catch((err)=>{
            res.send(err)
        })
    }else{
        res.send(false);
    }
})

//点赞动作
router.post('/blogZan', function (req, res) {
    var {token,blogId,isZan} = req.body;
    let userId=tokenUtil.getByKey(token,"userId");
    if(userId){
        console.log(`userId::${userId}`);
        zanQuery.changeZanPromise(userId,blogId,isZan).then(()=>{
            res.send('ok')
        }).catch((err)=>{
            res.send(err)
        })
    }else{
        res.send('false')
    }
});
module.exports = router;