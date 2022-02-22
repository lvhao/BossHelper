// ==UserScript==
// @name         Boss直聘小助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  first script
// @author       lvhao
// @match        https://www.zhipin.com/web/boss/recommend
// @grant        none
// @icon         https://www.zhipin.com/favicon.ico
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    /**
     * 打招呼助手
     */
    const bossHelper_plugin = {};

    /**
     * 简历收集助手
     */
    bossHelper_plugin.collectResume = {};

    /**
     * 打招呼助手
     */
    bossHelper_plugin.sayHi = {
        "props": {
            "helperMenuParent": "#header div.top-nav",
            "maskerParent": "iframe[name=recommendFrame]"
        },
        "state": {
            // ON, OFF
            "switch": "OFF",
            "sayHiCount": 0,
            "rememberCandicateQty": 0,
            "workDone": false
        },
        "init": function(settings){
            this.state.switch = settings.switch || "ON";
            this.state.sayHiCount = settings.sayHiCount;
            this.state.rememberCandicateQty = settings.rememberCandicateQty;
            this.state.workDone = settings.workDone;
            $("#say-hi-count").text(settings.sayHiCountText);

            this.simulator.init();
            this.eventQueue.emptyQueue();
        },
        "isRunning": function(){
            return this.state.switch === "ON";
        },
        "isWorkDone": function(){
            return this.state.workDone;
        },
        "trySetWorkDone": function(curQty){
            // 跟上次一样，说明没有数据了
            if(Number(this.state.rememberCandicateQty) == Number(curQty)){
                this.state.workDone = true;
            }
            this.state.rememberCandicateQty = curQty;
        },
        //生成从minNum到maxNum的随机数
        "waitASecond": function(){
            var minNum = 8;
            var maxNum = 15;
            return parseInt(Math.random()*(maxNum-minNum+1)+minNum,10) * 1000;
        },
        "sayHiIncrement": function() {
            var curCnt = Number(bossHelper_plugin.sayHi.state.sayHiCount) + 1;
            bossHelper_plugin.sayHi.state.sayHiCount = curCnt;
            $("#say-hi-count").text(curCnt);
        },
        "start": function(){
            this.init({
                "switch": "ON",
                "sayHiCount": 0,
                "sayHiCountText": "0",
                "rememberCandicateQty": 0,
                "workDone": false
            });

            // 筛选简历
            bossHelper_plugin.sayHi.simulator.screeningResumes(1, 15);
        },
        "stop": function(){
            this.init({
                "switch": "OFF",
                "sayHiCount": 0,
                "sayHiCountText": "???",
                "rememberCandicateQty": 0,
                "workDone": false
            });
        },
        // 简历判断
        "resumeFilter": {
            "resumeType": "backend",
            "init": function(){

            },
            // 生成校验后的html
            "generateFilterHtml": function(dataObj){
                var dataStr = Array.isArray(dataObj.data) ? dataObj.data.join(","): dataObj.data;
                var content = `
                    <li data-score="${dataObj.score}">
                        <span class="date">${dataObj.title}</span>
                        <span class="exp-content">${dataStr}</span>
                        <span class="exp-content">[ ${dataObj.result} ] - ${dataObj.remark}</span>
                    </li>
                `;
                return content;
            },
            "rule": {
                // 企业黑名单
                "companyBlacklist": function(cv, data) {
                    var matchedData = cv.filter(function(cve){
                        return data.filter(function(de){
                            return cve.indexOf(de) > -1;
                        }).length > 0;
                    });
                    return {
                        "title": "工作:",
                        "data": matchedData.length ? matchedData : cv,
                        "result": matchedData.length ? "❌" : "✅",
                        "remark": "企业黑名单",
                        "score": matchedData.length ? -50 : 0
                    };
                },
                // 公司白名单
                "companyWhitelist": function(cv, data) {
                    var matchedData = cv.filter(function(cve){
                        return data.filter(function(de){
                            return cve.indexOf(de) > -1;
                        }).length > 0;
                    });
                    return {
                        "title": "工作:",
                        "data": matchedData.length ? matchedData : cv,
                        "result": matchedData.length ? "✅" : "❌",
                        "remark": "企业白名单",
                        "score": matchedData.length ? 100 : 0
                    };
                },
                // 年龄小于多少岁
                "ageLessthen": function(cv, data) {
                    var r = cv <= data;
                    return {
                        "title": "年龄:",
                        "data": cv,
                        "result": r ? "✅" : "❌",
                        "remark": `年龄小于${data}岁`,
                        "score": r ? 0 : -50
                    };
                },
                // 学校是985、211
                "universityWhitelist": function(cv, data){
                    var matchedData = cv.filter(function(cve){
                        return $.inArray(cve, data) > 0;
                    });
                    return {
                        "title": "学校:",
                        "data": matchedData.length ? matchedData : cv,
                        "result": matchedData.length ? "✅" : "❌",
                        "remark": "名校",
                        "score": matchedData.length ? 50 : 0
                    };
                },
                // 简历关键子匹配
                "matchKeyword":function(cv, data){
                    var matchedData = data.filter(function(d){
                        return cv.indexOf(d) > -1;
                    });
                    return {
                        "title": "关键字:",
                        "data": matchedData,
                        "result": matchedData.length ? "✅" : "❌",
                        "remark": `关键字匹配`,
                        "score": matchedData.length ? 10 : 0
                    };
                }
            },
            "apply": function(){
                var $docDefaultDiv = $("iframe[name=recommendFrame]").contents().find("div[default]");
                var $ulEle = $docDefaultDiv.find("#evaluate ul");
                var rulekeyDataList = this.configuration[this.resumeType];
                var generateFilterHtmlCaller = this.generateFilterHtml;
                var ruleRefer = this.rule;

                var filterDataMap = {
                    "companyBlacklist": function(){
                        return $docDefaultDiv.find(".resume-summary ul.jobs")
                        .not(".project,.education").find("h3 span")
                        .map(function(){
                            return $(this).text();
                        }).get();
                    },
                    "companyWhitelist": function(){
                        return this.companyBlacklist();
                    },
                    "ageLessthen": function(){
                        return $docDefaultDiv.find("#resume-page i.fz-age").next().text().replace('岁','');
                    },
                    "universityWhitelist":function(){
                        var r = [];
                        var schoolTags = $docDefaultDiv.find("#resume-page p.school-tags span").map(function(){
                            return $(this).text();
                        }).get();
                        var schools = $docDefaultDiv.find(".resume-summary ul.jobs.education").find("h3 span").map(function(){
                            return $(this).text();
                        }).get();
                        return r.concat(schoolTags,schools);
                    },
                    "matchKeyword": function(){
                        return $docDefaultDiv.find(".resume-item-content").text();
                    }
                };
                $.each(rulekeyDataList,function(rk,kd){
                    var cv = filterDataMap[rk]();
                    var htmlData = ruleRefer[rk](cv,kd.data);
                    var htmlContent = generateFilterHtmlCaller(htmlData);
                    $ulEle.append(htmlContent);
                });
            },
            "configuration": {
                "backend": {
                    "companyBlacklist": {"data":[
                        "文思海辉","中软国际","佰钧成",
                        "软通动力","博彦科技","信必优","神州数码"
                        ,"浙大网新","平安","东软集团"
                    ]},
                    "companyWhitelist": {"data":["阿里","腾讯","美团","京东","乐信","OPPO","VIVO","华为"]},
                    "ageLessthen": {"data": 30},
                    "universityWhitelist": {"data":["985院校","211院校","QS世界大学排名TOP500"]},
                    "matchKeyword": {
                        "data": ["高并发","博客","读书","源码","开源","github"]
                    }
                },
                "frontend": []
            }
        },
        "eventQueue": {
            "data":[],
            "enqueue": function(eId) {
                this.data.push(eId);
            },
            "emptyQueue": function(){
                this.data.forEach(function(eId){
                    clearTimeout(eId);
                });
            },
        },
        // 事件模拟器
        "simulator": {
            "totalElapsedTime": 0,
            "init": function(){
                this.totalElapsedTime = 0;
                this.closeEvaluateTips();
            },
            "timeConsuming": function(mills){
                bossHelper_plugin.sayHi.simulator.totalElapsedTime += Number(mills);
                return bossHelper_plugin.sayHi.simulator.totalElapsedTime;
            },
            "closeEvaluateTips": function(){
                var $docDefaultDiv = $("iframe[name=recommendFrame]").contents().find("div[default]");
                $docDefaultDiv.find("#evaluate ul").empty();
                $docDefaultDiv.find("#evaluate").hide();
            },
            "showEvaluateTips": function() {
                var $docDefaultDiv = $("iframe[name=recommendFrame]").contents().find("div[default]");
                var candicateName = $docDefaultDiv.find("#resume-page div.geek-name").text()
                var $evaluateEle = $docDefaultDiv.find("#evaluate");
                $evaluateEle.find("#candicateName").text(candicateName);
                $evaluateEle.show();
                
                // 开始过滤信息
                bossHelper_plugin.sayHi.resumeFilter.apply();

                //判定算法
                var scoreArray = $evaluateEle.find("li[data-score]").map(function(){
                    return $(this).data("score");
                }).get();
                var finalScore = scoreArray.reduce(function(prev, curr){
                    return prev + curr;
                });
                $evaluateEle.data("sayHi", finalScore > 0);
                var evaluateText = finalScore > 0 ? `YES（${finalScore}分）` : `NO（${finalScore}分）`
                $evaluateEle.find("#scorePanel").text(evaluateText);
            },
            /**
             * 点击下一页
             * @param clickCount
             */
            "clickNextPage": function(clickCount){                
                var eId = setTimeout(() => {
                    // 找到recommendFrame
                    if(window.frames[0].name === "recommendFrame"){
                        window.frames[0].scroll(0, 9999 * clickCount);
                    }
                }, bossHelper_plugin.sayHi.simulator.timeConsuming(1000));
                bossHelper_plugin.sayHi.eventQueue.enqueue(eId);
            },
            "needToSayHi": function(){
                var $recommendFrame = $("iframe[name=recommendFrame]").contents();
                var $evaluateEle = $recommendFrame.find("#evaluate");
                return $evaluateEle.data("sayHi");
            },
            "clickSayHiBtn": function(){
                var $recommendFrame = $("iframe[name=recommendFrame]").contents();
                // $recommendFrame.find("#resume-page button.btn-greet")[0].click();
                bossHelper_plugin.sayHi.sayHiIncrement();
            },
            /**
             * 点击候选人卡片
             * @param canSayHicandidates
             */
            "clickCandicateCard": function(canSayHicandidates){
                var $recommendFrame = $("iframe[name=recommendFrame]").contents();

                // 延迟等待页面响应，至少10秒
                // 第一秒点击详情
                // 倒数第5秒展示评估信息
                // 浏览X秒后，关闭弹窗
                $.each(canSayHicandidates, function(idx, ele){
                    // 点击候选人详情
                    var eId1 = setTimeout(() => {
                        if(!bossHelper_plugin.sayHi.isRunning()) return;
                        debugger
                        $(ele).find("div.card-inner")[0].click();
                    }, bossHelper_plugin.sayHi.simulator.totalElapsedTime + 1000);
                    bossHelper_plugin.sayHi.eventQueue.enqueue(eId1);

                    // 获取信息等待评估
                    var eId2 = setTimeout(() => {
                        if(!bossHelper_plugin.sayHi.isRunning()) return;
                        // 展示关键判定信息
                        bossHelper_plugin.sayHi.simulator.showEvaluateTips();
                    }, bossHelper_plugin.sayHi.simulator.totalElapsedTime + 2500);
                    bossHelper_plugin.sayHi.eventQueue.enqueue(eId2);

                    // 本次操作总耗时
                    bossHelper_plugin.sayHi.simulator.timeConsuming(bossHelper_plugin.sayHi.waitASecond());
                    
                    // 延迟点击关闭
                    var eId3 = setTimeout(() => {
                        if(!bossHelper_plugin.sayHi.isRunning()) return;

                        // 点击沟通
                        if(bossHelper_plugin.sayHi.simulator.needToSayHi()){
                            bossHelper_plugin.sayHi.simulator.clickSayHiBtn();
                        }
                        
                        // 关闭遮罩层
                        bossHelper_plugin.sayHi.simulator.closeEvaluateTips();

                        // 关闭候选人信息页
                        var $closeBtn = $recommendFrame.find(".resume-dialog span.resume-custom-close")[0];
                        if($closeBtn) $closeBtn.click();
                    }, bossHelper_plugin.sayHi.simulator.totalElapsedTime);
                    bossHelper_plugin.sayHi.eventQueue.enqueue(eId3);
                });
            },
            /**
             * 获取请求页可以打招呼的候选人
             * @param pageNo 
             * @param pageSize 
             * @returns 
             */
            "loadCanSayHiCandicates": function(pageNo, pageSize) {
                var $recommendFrame = $("iframe[name=recommendFrame]").contents();

                // 获取候选人行
                var sliceIdx = (pageNo - 1) * pageSize;
                var candidateList = $recommendFrame.find("#recommend-list").find("ul.recommend-card-list").children();

                // 对比上次数据，尝试结束工作
                bossHelper_plugin.sayHi.trySetWorkDone(candidateList.length);
                
                // 返回可以打招呼的行，不重复打招呼
                return candidateList.slice(sliceIdx).filter(function() {
                    return $("button.btn-greet", this).length === 1;
                });
            },
            /**
             * 筛选简历
             * @param pageNo 
             * @param pageSize 
             */
            "screeningResumes": function(pageNo, pageSize) {
                // 插件关闭或者全部完成，跳出循环
                if(!bossHelper_plugin.sayHi.isRunning()) return;
                if(bossHelper_plugin.sayHi.isWorkDone()) return;

                // 获取下一页可以打招呼的候选人列表
                var canSayHiCandicates = this.loadCanSayHiCandicates(pageNo, pageSize);

                // 打开候选人详情页
                this.clickCandicateCard(canSayHiCandicates);

                // 点击下一页
                pageNo++;
                this.clickNextPage(pageNo);

                // 等待数据加载完，开启下一轮
                var eId = setTimeout(() => {
                    return this.screeningResumes(pageNo, pageSize);
                }, bossHelper_plugin.sayHi.simulator.timeConsuming(3000));
                bossHelper_plugin.sayHi.eventQueue.enqueue(eId);
            }
        },
        "registerEvent": function(){
            // 菜单事件
            $("#switch-config").click(function () {
                if($(this).hasClass("ui-switch-checked")){
                    $(this).removeClass("ui-switch-checked");
                    $(this).find("input").val(false);
                    bossHelper_plugin.sayHi.stop();
                }
                else{
                    $(this).addClass("ui-switch-checked");
                    $(this).find("input").val(true);
                    bossHelper_plugin.sayHi.start();
                }
            });
        },
        "render" : function(){
            // 小助手界面入口
            var helperView = `
                <div id="zan-joy" class="nav-item">
                    <div class="label-name records-center">
                        🤖 SayHi 
                        <span id="switch-config" class="ui-switch">
                            <input type="hidden" value="true">
                            <span class="ui-switch-inner"></span>
                        </span>
                        <span id="say-hi-count" style="text-align: center;color: #fff;background-color: #fe574a; padding-left: 5px;padding-right: 5px;">???</span>
                    </div>
                </div>`;
            $(this.props.helperMenuParent).append(helperView);

            //信息判定框
            var msgStyle = `
                width: 400px;
                height: 450px;
                color: #ffffff;
                background-color: #3a475ce8;
                border-radius:4px;
                position: fixed;
                padding: 25px;
                top: 10%;
                margin: 0 auto;
                z-index: 999999;
                left: 35%;
                display: none;
                font-size: 20px;
                opacity: 0.7;
            `;
            var msgArea = `<div id="evaluate" align="center" style="${msgStyle}">
                <div id="candicateName" align="center">简历评估</div>
                <ul style="margin-top: 30px;text-align: left;font-size:15px;">
                </ul>
                <div id="scorePanel" style="margin-top: 50px;text-align:center;font-size:20px;"></div>
            </div>`;
            $("iframe[name=recommendFrame]").contents().find("div[default]").append(msgArea);
        },
        "run": function(settings){
            // 小助手初始化
            var eId = setTimeout(function(){
                bossHelper_plugin.sayHi.render();
                bossHelper_plugin.sayHi.registerEvent();
                bossHelper_plugin.sayHi.resumeFilter.resumeType = settings['resumeType'] || "backend";
            },5000);
            bossHelper_plugin.sayHi.eventQueue.enqueue(eId);
        }
    }

    bossHelper_plugin.run = function(){
        bossHelper_plugin.sayHi.run({"resumeType":"backend"});
    }

    // 运行插件
    bossHelper_plugin.run();
})();
