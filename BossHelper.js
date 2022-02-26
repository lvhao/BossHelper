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

(function () {
    'use strict';
    /**
     * BOSS直聘小助手
     */
    class BossHelper {

        constructor() {
            // ON, OFF
            this.workingState = "OFF";

            // ON状态下，没有简历可以操作了
            this.workDone = false;

            // 菜单bar
            this.menuBar = new BossHelperBar({
                parentDocument: "#header div.top-nav",
                plugin: this
            });
        }

        start() {
            this.workingState = "ON";
            this.workDone = false;
        }

        stop() {
            this.workingState = "OFF";
            this.workDone = false;
        }

        isRunning() {
            return this.workingState === "ON";
        }

        isWorkDone() {
            return this.workDone;
        }

        tryFinishWork(curretnfindingResumeCount) {
            let menuState = this.menuBar.countingBar;
            // 跟上次一样，说明没有数据了
            if (Number(menuState.findingResumeCount) == Number(curretnfindingResumeCount)) {
                this.workDone = true;
            }
            return this.workDone;
        }
    }

    /**
     * 
     */
    class BossHelperBar {
        static DEFAULT_PARENT_DOC = "#header div.top-nav";
        static DEFAULT_COUNTING_BAR = {
            // 打招呼数量
            sayHiCount: 0,
            // 查看详情数量
            screeningResumeCount: 0,
            // 获取简历数量
            findingResumeCount: 0
        };

        constructor(settings) {
            this.parentDocument = settings.parentDocument || BossHelperBar.DEFAULT_PARENT_DOC;
            this.plugin = settings.plugin;
            this.countingBar = settings.countingBar || Object.assign({}, BossHelperBar.DEFAULT_COUNTING_BAR);
            this.render();
            this.registerEvent();
        }

        registerEvent() {
            var plugin = this.plugin;
            // 小助手开关
            $("#switch-config").click(function () {
                if ($(this).hasClass("ui-switch-checked")) {
                    $(this).removeClass("ui-switch-checked");
                    $(this).find("input").val(false);
                    plugin.stop();
                } else {
                    $(this).addClass("ui-switch-checked");
                    $(this).find("input").val(true);
                    plugin.start();
                }
            });
        }

        render() {
            // 小助手界面入口
            let helperView = `
                <div id="helper-bar" class="nav-item">
                    <div class="label-name records-center">
                        <span style="font-size: medium;vertical-align: middle;">🤖 SayHi</span> 
                        <span id="switch-config" class="ui-switch">
                            <input type="hidden" value="true">
                            <span class="ui-switch-inner"></span>
                        </span>
                        <span id="counting-bar" style="border-radius: 5px;text-align: center;color: #fff;background-color: #fe574a; padding-left: 5px;padding-right: 5px;font-size: medium;vertical-align: middle;">? / ? / ?</span>
                    </div>
                </div>`;
            $(this.parentDocument).append(helperView);
        }

        refreshSayHiCount() {
            this.countingBar.sayHiCount += 1;
            this.refreshCountingBar();
        }

        refreshScreeningResumeCount() {
            this.countingBar.screeningResumeCount += 1;
            this.refreshCountingBar();
        }

        refreshFindingResumeCount(qty) {
            this.countingBar.findingResumeCount = qty;
            this.refreshCountingBar();
        }

        refreshCountingBar() {
            let {
                sayHiCount,
                screeningResumeCount,
                findingResumeCount
            } = this.countingBar;
            let showText = `${sayHiCount} / ${screeningResumeCount} / ${findingResumeCount}`;
            $("#counting-bar").text(showText);
        }

        reset() {
            this.countingBar = Object.assign({}, BossHelperBar.DEFAULT_COUNTING_BAR);
            this.refreshCountingBar();
        }
    }

    /**
     * 任务调度器
     */
    class TaskTimer {
        constructor(name) {
            this.name = name;
            this.elapsedTime = 0;
            this.eventQueue = [];
        }

        recordTask(eId) {
            this.eventQueue.push(eId);
        }

        reset() {
            this.elapsedTime = 0;
            this.eventQueue.forEach((eId) => {
                clearTimeout(eId);
            });
            this.eventQueue = [];
        }

        timeConsuming(mills) {
            this.elapsedTime += Number(mills);
            return this.elapsedTime;
        }

        delayInvoke(funcCaller, delayMills) {
            let timeId = setTimeout(() => {
                funcCaller();
            }, this.timeConsuming(delayMills));
            this.recordTask(timeId);
        }

        //生成从minNum到maxNum的随机数
        waitSecondBetween(minSecond, maxSecond) {
            return parseInt(Math.random() * (maxSecond - minSecond + 1) + minSecond, 10) * 1000;
        }
    }

    /**
     * 简历判定看板
     */
    class ResumeJudgementBoard {
        constructor(settings) {
            this.rootDocument = settings.rootDocument;
            this.render();
        }

        render() {
            //信息判定框
            let msgStyle = `
                width: 400px; height: 450px; color: #ffffff; background-color: #3a475ce8;
                border-radius:4px; position: fixed; padding: 25px; top: 10%; margin: 0 auto;
                z-index: 999999; left: 35%; display: none;
                font-size: 20px; opacity: 0.7;
            `;
            let msgArea = `<div id="judgement-board" align="center" style="${msgStyle}">
                <div id="candicateName" align="center">简历评估</div>
                <ul style="margin-top: 30px;text-align: left;font-size:15px;">
                </ul>
                <div id="scorePanel" style="margin-top: 50px;text-align:center;font-size:20px;"></div>
            </div>`;
            $(this.rootDocument).contents().find("div[default]").append(msgArea);
        }

        generateFilterHtmlResult(dataObj) {
            let dataStr = Array.isArray(dataObj.data) ? dataObj.data.join(",") : dataObj.data;
            let content = `
                <li data-score="${dataObj.score}">
                    <span class="date">${dataObj.title}</span>
                    <span class="exp-content">${dataStr}</span>
                    <span class="exp-content">[ ${dataObj.resultHtml} ] - ${dataObj.remark}</span>
                </li>
            `;
            return content;
        }

        show(filterResultData) {
            let $docDefaultDiv = $(this.rootDocument).contents().find("div[default]");
            let candicateName = $docDefaultDiv.find("#resume-page div.geek-name").text()
            let $evaluateEle = $docDefaultDiv.find("#judgement-board");

            // 展示看板
            $evaluateEle.find("#candicateName").text(candicateName);
            $evaluateEle.show();

            // 展示过滤器判定信息
            var self = this;
            let htmlContent = filterResultData.map(function (frd) {
                return self.generateFilterHtmlResult(frd);
            }).join("");
            $docDefaultDiv.find("#judgement-board ul").append(htmlContent);

            // 应用判定算法
            let finalScore = filterResultData.map(function (frd) {
                return frd.score;
            })
                .reduce(function (prev, curr) {
                    return prev + curr;
                });
            $evaluateEle.data("sayHi", finalScore > 0);
            let evaluateText = finalScore > 0 ? `YES（${finalScore}分）` : `NO（${finalScore}分）`
            $evaluateEle.find("#scorePanel").text(evaluateText);
        }

        close() {
            let $docDefaultDiv = $(this.rootDocument).contents().find("div[default]");
            $docDefaultDiv.find("#judgement-board ul").empty();
            $docDefaultDiv.find("#judgement-board").hide();
        }
    }

    /**
     * 过滤器
     */
    class ResumeFilter {
        constructor(id, filterConfig) {
            this.id = id;
            this.data = filterConfig.data;
            this.matchScore = filterConfig.matchScore;
            this.nonMatchScore = filterConfig.nonMatchScore;
        }

        doFilter(inputValue) { }
    }

    /**
     * 企业黑名单过滤器
     */
    class CompanyBlacklistFilter extends ResumeFilter {
        constructor(filterConfig) {
            super("companyBlacklist", filterConfig);
        }

        doFilter(cv) {
            let self = this;
            let matchedData = cv.filter(function (cve) {
                return self.data.filter(function (de) {
                    return cve.indexOf(de) > -1;
                }).length > 0;
            });
            return {
                "title": "工作:",
                "data": matchedData.length ? matchedData : cv,
                "result": !matchedData.length,
                "resultHtml": matchedData.length ? "❌" : "✅",
                "remark": "企业黑名单",
                "score": matchedData.length ? this.matchScore : this.nonMatchScore
            };
        }
    }

    /**
     * 企业白名单过滤器
     */
    class CompanyWhitelistFilter extends ResumeFilter {
        constructor(filterConfig) {
            super("companyWhitelist", filterConfig);
        }

        doFilter(cv) {
            let self = this;
            let matchedData = cv.filter(function (cve) {
                return self.data.filter(function (de) {
                    return cve.indexOf(de) > -1;
                }).length > 0;
            });
            return {
                "title": "工作:",
                "data": matchedData.length ? matchedData : cv,
                "result": matchedData.length,
                "resultHtml": matchedData.length ? "✅" : "❌",
                "remark": "企业白名单",
                "score": matchedData.length ? this.matchScore : this.nonMatchScore
            };
        }
    }

    /**
     * 年龄过滤器
     */
    class AgeLessthenFilter extends ResumeFilter {
        constructor(filterConfig) {
            super("ageLessthen", filterConfig);
        }

        doFilter(cv) {
            let r = cv <= this.data;
            return {
                "title": "年龄:",
                "data": cv,
                "result": r,
                "resultHtml": r ? "✅" : "❌",
                "remark": `年龄小于${this.data}岁`,
                "score": r ? this.matchScore : this.nonMatchScore
            };
        }
    }

    /**
     * 大学白名单过滤器
     */
    class UniversityWhitelistFilter extends ResumeFilter {
        constructor(filterConfig) {
            super("universityWhitelist", filterConfig);
        }

        doFilter(cv) {
            var self = this;
            let matchedData = cv.filter(function (cve) {
                return $.inArray(cve, self.data) > -1;
            });
            return {
                "title": "学校:",
                "data": matchedData.length ? matchedData : cv,
                "result": matchedData.length,
                "resultHtml": matchedData.length ? "✅" : "❌",
                "remark": "名校",
                "score": matchedData.length ? self.matchScore : self.nonMatchScore
            };
        }
    }

    /**
     * 关键字过滤器
     */
    class MatchKeywordFilter extends ResumeFilter {
        constructor(filterConfig) {
            super("matchKeyword", filterConfig);
        }

        doFilter(cv) {
            let matchedData = this.data.filter(function (d) {
                return cv.indexOf(d) > -1;
            });
            return {
                "title": "关键字:",
                "data": matchedData,
                "result": matchedData.length,
                "resultHtml": matchedData.length ? "✅" : "❌",
                "remark": `关键字匹配`,
                "score": matchedData.length ? this.matchScore : this.nonMatchScore
            };
        }
    }

    class ResumeFilterChain {
        constructor(filters) {
            let filterInstances = filters.map(function (f) {
                return Reflect.construct(f.filter, [f.filterConfig]);
            });
            this.filterInstances = filterInstances;
        }
        doFilter(resumeData) {
            let usedFilters = this.filterInstances;
            return $.map(usedFilters, function (f) {
                let cv = resumeData[f.id];
                return f.doFilter(cv);
            });
        }
    }

    /**
     * 简历搜索插件
     */
    class ScreeningResumePlugin extends BossHelper {
        constructor(filters) {
            super();
            this.timer = new TaskTimer("简历筛选助手");
            this.rootDocument = "iframe[name=recommendFrame]";
            this.resumeFilterChain = new ResumeFilterChain(filters);
            this.resumeJudgementBoard = new ResumeJudgementBoard({
                rootDocument: this.rootDocument
            });
        }

        /**
         * 点击下一页
         * @param clickCount
         */
        clickNextPage(clickCount) {
            this.timer.delayInvoke(() => {
                // 找到recommendFrame
                if (window.frames[0].name === "recommendFrame") {
                    window.frames[0].scroll(0, 9999 * clickCount);
                }
            }, 1000);
        }

        clickSayHiBtn() {
            let $recommendFrame = $(this.rootDocument).contents();
            // $recommendFrame.find("#resume-page button.btn-greet")[0].click();
            this.menuBar.refreshSayHiCount();
        }

        /**
         * 获取请求页可以打招呼的候选人
         * @param pageNo 
         * @param pageSize 
         * @returns 
         */
        findCanSayHiResumes(pageNo, pageSize) {
            let menuBar = this.menuBar;
            let $recommendFrame = $(this.rootDocument).contents();

            // 获取候选人行
            let sliceIdx = (pageNo - 1) * pageSize;
            let resumes = $recommendFrame.find("#recommend-list").find("ul.recommend-card-list").children();

            // 对比上次数据，尝试结束工作
            if(this.tryFinishWork(resumes.length)){
                return [];
            }

            // 刷新查到的简历量
            menuBar.refreshFindingResumeCount(resumes.length);

            // 返回可以打招呼的行，不重复打招呼
            return resumes.slice(sliceIdx).filter(function () {
                return $("button.btn-greet", this).length === 1;
            });
        }

        needToSayHi() {
            let $evaluateEle = $(this.rootDocument).contents().find("#judgement-board");
            return $evaluateEle.data("sayHi");
        }

        getResumeData() {
            let $docDefaultDiv = $(this.rootDocument).contents().find("div[default]");
            let companyList = (function () {
                return $docDefaultDiv.find(".resume-summary ul.jobs")
                    .not(".project,.education").find("h3 span")
                    .map(function () {
                        return $(this).text();
                    }).get();
            }());
            return {
                companyBlacklist: companyList,
                companyWhitelist: companyList,
                ageLessthen: (function () {
                    return $docDefaultDiv.find("#resume-page i.fz-age").next().text().replace('岁', '');
                }()),
                universityWhitelist: (function () {
                    let r = [];
                    let schoolTags = $docDefaultDiv.find("#resume-page p.school-tags span").map(function () {
                        return $(this).text();
                    }).get();
                    let schools = $docDefaultDiv.find(".resume-summary ul.jobs.education").find("h3 span").map(function () {
                        return $(this).text();
                    }).get();
                    return r.concat(schoolTags, schools);
                }()),
                matchKeyword: (function () {
                    return $docDefaultDiv.find(".resume-item-content").text();
                }())
            };
        }

        /**
         * 点击简历卡片
         * @param canSayHicandidates
         */
        clickResumeCard(canSayHiResumes) {
            let $recommendFrame = $(this.rootDocument).contents();

            // 延迟等待页面响应，至少10秒
            // 第一秒点击详情
            // 倒数第5秒展示评估信息
            // 浏览X秒后，关闭弹窗
            let self = this;
            let menuBar = self.menuBar;
            let filterChain = this.resumeFilterChain;
            let board = this.resumeJudgementBoard;
            let timer = this.timer;
            let pluginIsRunning = this.isRunning();
            $.each(canSayHiResumes, function (idx, ele) {
                // 点击候选人详情
                timer.delayInvoke(() => {
                    if (!pluginIsRunning) return;
                    $(ele).find("div.card-inner")[0].click();
                    menuBar.refreshScreeningResumeCount();
                }, 1000);

                // 获取信息等待评估
                timer.delayInvoke(() => {
                    if (!pluginIsRunning) return;

                    // 获取候选人信息
                    let resumeData = self.getResumeData();

                    // 过滤规则结果
                    let filterResultData = filterChain.doFilter(resumeData);

                    // 看板展示
                    board.show(filterResultData);
                }, 1600);

                // 延迟点击关闭
                timer.delayInvoke(() => {
                    if (!pluginIsRunning) return;

                    // 点击沟通
                    if (self.needToSayHi()) {
                        self.clickSayHiBtn();
                    }

                    // 关闭遮罩层
                    board.close();

                    // 关闭候选人信息页
                    let $closeBtn = $recommendFrame.find(".resume-dialog span.resume-custom-close")[0];
                    if ($closeBtn) $closeBtn.click();
                }, timer.waitSecondBetween(8, 20));
            });
        }

        /**
         * 筛选简历
         * @param pageNo 
         * @param pageSize 
         */
        screeningResumes(pageNo, pageSize) {
            // 新轮回，时间线回归到0
            this.timer.reset();

            var pluginIsRunning = this.isRunning();
            var pluginIsWorkDone = this.isWorkDone();
            // 插件关闭或者全部完成，跳出循环
            if (!pluginIsRunning) return;
            if (pluginIsWorkDone) {
                let {
                    sayHiCount,
                    screeningResumeCount,
                    findingResumeCount
                } = menuBar.countingBar;
                let showText = `
                    已完成全部简历筛选了 🎉
                    打招呼数量：${sayHiCount}
                    查看简历数量：${screeningResumeCount}
                    检索简历数量：${findingResumeCount}`;
                alert(showText);
                return;
            }
            // 获取当前页可以打招呼的候选人列表
            let canSayHiCandicates = this.findCanSayHiResumes(pageNo, pageSize);

            // 逐个打开候选人详情页
            this.clickResumeCard(canSayHiCandicates);

            // 点击下一页
            pageNo++;
            this.clickNextPage(pageNo);

            // 等待数据加载完，开启下一轮
            this.timer.delayInvoke(() => {
                this.screeningResumes(pageNo, pageSize);
            }, 3000);
        }

        reday() {
            this.menuBar.reset();
            this.resumeJudgementBoard.close();
            this.timer.reset();
        }

        start() {
            super.start();
            this.screeningResumes(1, 15);
        }

        stop() {
            super.stop();
            this.reday();
        }
    }

    // 后端过滤规则配置
    const backendFilterCfg = [{
        filter: CompanyWhitelistFilter,
        filterConfig: {
            data: ["阿里", "腾讯", "美团", "京东", "乐信", "OPPO","VIVO", "华为", "字节","头条","货拉拉", "顺丰"],
            matchScore: 100,
            nonMatchScore: 0
        }
    },
    {
        filter: CompanyBlacklistFilter,
        filterConfig: {
            data: ["文思海辉", "中软", "佰钧成", "软通动力", "博彦", "信必优", "神州数码", "浙大网新", "东软"],
            matchScore: -50,
            nonMatchScore: 0
        }
    },
    {
        filter: AgeLessthenFilter,
        filterConfig: {
            data: 30,
            matchScore: 0,
            nonMatchScore: -50
        }
    },
    {
        filter: UniversityWhitelistFilter,
        filterConfig: {
            data: ["985院校", "211院校", "QS世界大学排名TOP500", "双一流院校"],
            matchScore: 50,
            nonMatchScore: 0
        }
    },
    {
        filter: MatchKeywordFilter,
        filterConfig: {
            data: ["高并发", "博客", "读书", "源码", "开源", "github"],
            matchScore: 10,
            nonMatchScore: 0
        }
    }
    ];

    /**
     * 启用插件
     */
    let bossHelper = {};
    bossHelper.plugin = {
        run: function () {
            setTimeout(() => {
                let screeningResumePlugin = new ScreeningResumePlugin(backendFilterCfg);
                screeningResumePlugin.reday();
            }, 4000)
        }
    }

    // 运行插件
    bossHelper.plugin.run();
})();
