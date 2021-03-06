Tea.context(function () {
    var that = this;

    this.logs = [];
    this.sourceLogs = [];
    this.fromId = "";
    this.total = 0;
    this.countSuccess = 0;
    this.countFail = 0;
    this.qps = 0;

    this.isPlaying = true;
    this.started = false;

    // 搜索相关
    this.searchBoxVisible = teaweb.getBool("searchBoxVisible");
    this.searchIp = teaweb.getString("searchIp");
    this.searchDomain = teaweb.getString("searchDomain");
    this.searchOs = teaweb.getString("searchOs");
    this.searchBrowser = teaweb.getString("searchBrowser");
    this.searchMinCost = teaweb.getString("searchMinCost");
    this.searchKeyword = teaweb.getString("searchKeyword");

    this.$delay(function () {
        this.loadLogs();

        this.$watch("searchIp", function (value) {
            that.filterLogs()
        });
        this.$watch("searchDomain", function (value) {
            that.filterLogs()
        });
        this.$watch("searchOs", function (value) {
            that.filterLogs()
        });
        this.$watch("searchBrowser", function (value) {
            that.filterLogs()
        });
        this.$watch("searchMinCost", function (value) {
            that.filterLogs()
        });
        this.$watch("searchKeyword", function (value) {
            that.filterLogs()
        });
    });

    window.addEventListener("unload", function () {
        teaweb.set("searchIp", that.searchIp);
        teaweb.set("searchDomain", that.searchDomain);
        teaweb.set("searchOs", that.searchOs);
        teaweb.set("searchBrowser", that.searchBrowser);
        teaweb.set("searchMinCost", that.searchMinCost);
        teaweb.set("searchKeyword", that.searchKeyword);
    });

    var loadSize = 100;
    this.loadLogs = function () {
        // 是否正在播放日志
        if (!this.isPlaying) {
            return;
        }

        var lastSize = 0;
        this.$get(".get")
            .params({
                "server": this.server.filename,
                "fromId": this.fromId,
                "size": loadSize,
                "bodyFetching": this.bodyFetching ? 1 : 0
            })
            .success(function (response) {
                // 日志
                lastSize = response.data.logs.length;
                if (lastSize == loadSize) {
                    loadSize = 1000;
                } else {
                    loadSize = 100;
                }

                this.total = Math.ceil(response.data.total * 100 / 10000) / 100;
                this.countSuccess = Math.ceil(response.data.countSuccess * 100 / 10000) / 100;
                this.countFail = Math.ceil(response.data.countFail * 100 / 10000) / 100;
                this.qps = response.data.qps;

                this.sourceLogs = response.data.logs.concat(this.sourceLogs);
                this.sourceLogs.$each(function (_, log) {
                    if (typeof(log["isOpen"]) === "undefined") {
                        log.isOpen = false;
                    }

                    // 浏览器图标
                    var browserFamily = log.extend.client.browser.family.toLowerCase();
                    log.browserIcon = "";
                    if ([ "chrome", "firefox", "safari", "opera", "edge", "internet explorer" ].$contains(browserFamily)) {
                        log.browserIcon = browserFamily;
                    } else if (browserFamily == "ie") {
                        log.browserIcon = "internet explorer";
                    } else if (browserFamily == "other") {
                        log.extend.client.browser.family = "";
                    }
                });

                if (this.sourceLogs.length > 0) {
                    this.fromId = this.sourceLogs.$first().id;

                    if (this.sourceLogs.length > 100) {
                        this.sourceLogs = this.sourceLogs.slice(0, 100);
                    }
                }

                this.filterLogs();
            })
            .done(function () {
                this.started = true;

                // 每1秒刷新一次
                Tea.delay(function () {
                    this.loadLogs();
                }, (lastSize < loadSize) ? 1000 : 100)
            });
    };

    this.log_animation = function (log) {
        return;
        /**if (log.animationIsInitialized) {
            return "log-line";
        }
       log.animationIsInitialized = true;
        return "log-animation-init";**/
    };

    this.showLog = function (index) {
        var log = this.logs[index];
        log.isOpen = !log.isOpen;
        log.tabName = "summary";

        // 由于Vue的限制直接设置 log.isOpen 并不起作用
        this.$set(this.logs, index, log);

        // 关闭别的
        if (log.isOpen) {
            this.logs.$each(function (k, v) {
                if (v.id != log.id) {
                    v.isOpen = false;
                }
            });
        }
    };

    this.formatCost = function (seconds) {
        var s = (seconds * 1000).toString();
        var pieces = s.split(".");
        if (pieces.length < 2) {
            return s;
        }

        return pieces[0] + "." + pieces[1].substr(0, 3);
    };

    this.showSearchBox = function () {
        this.searchBoxVisible = true;
        teaweb.set("searchBoxVisible", true);
    };

    this.hideSearchBox = function () {
        this.searchBoxVisible = false;
        teaweb.set("searchBoxVisible", false);
    };

    this.hasSearchConditions = function () {
        var has = false;
        this.$find(".search-box form input").each(function (k, v) {
           if (typeof(v.value) == "string" && v.value.trim().length > 0) {
               has = true;
           }
        });
        return has;
    };

    this.resetSearchBox = function () {
        that.searchIp = "";
        that.searchDomain = "";
        that.searchOs = "";
        that.searchBrowser = "";
        that.searchMinCost = "";
        that.searchKeyword = "";
    };

    this.filterLogs = function () {
        this.logs = this.sourceLogs.$filter(function (_, log) {
            if (!teaweb.match(log.remoteAddr, that.searchIp)) {
                return false;
            }

            if (!teaweb.match(log.host, that.searchDomain)) {
                return false;
            }

            if (typeof(log.extend.client.os.family) != "undefined" && !teaweb.match(log.extend.client.os.family, that.searchOs)) {
                return false;
            }

            if (typeof(log.extend.client.browser.family) != "undefined" && !teaweb.match(log.extend.client.browser.family, that.searchBrowser)) {
                return false;
            }

            if (that.searchMinCost.length > 0) {
                var cost = parseFloat(that.searchMinCost);
                if (isNaN(cost) || log.requestTime < cost * 0.001) {
                    return false;
                }
            }

            if (that.searchKeyword != null && that.searchKeyword.length > 0) {
                var values = [
                    log.requestPath,
                    log.requestURI,
                    log.userAgent,
                    log.remoteAddr,
                    log.requestMethod,
                    log.statusMessage,
                    log.timeLocal,
                    log.timeISO8601,
                    log.host,
                    log.request,
                    log.contentType,
                    JSON.stringify(log.extend)
                ];

                var found = false;
                for (var i = 0; i < values.length; i ++) {
                    if (teaweb.match(values[i], that.searchKeyword)) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    return false;
                }
            }

            return true;
        });
    };

    this.showLogTab = function (log, index, tabName) {
        // 综合信息
        if (tabName == "summary") {

        }

        // 响应信息
        else if (tabName == "responseHeader") {
            if (typeof(log.responseHeaders) == "undefined") {
                this.$get(".responseHeader." + log.id)
                    .success(function (response) {
                        log.responseHeaders = response.data.headers;
                        log.responseBody = response.data.body;
                    });
            }
        }

        // 请求信息
        else if (tabName == "request") {
            if (typeof(log.requestHeaders) == "undefined") {
                this.$get(".requestHeader." + log.id)
                    .success(function (response) {
                        log.requestHeaders = response.data.headers;
                        log.requestBody = response.data.body;
                        log.hasRequestHeaders = false;
                        for (var k in log.requestHeaders) {
                            if (log.requestHeaders.hasOwnProperty(k)) {
                                log.hasRequestHeaders = true;
                                break;
                            }
                        }
                    });
            }
        }

        // 预览
        else if (tabName == "preview") {
            if (typeof(log.responseHeaders) == "undefined") {
                log.previewImageLoaded = false;
                this.$get(".responseHeader." + log.id)
                    .success(function (response) {
                        log.responseHeaders = response.data.headers;
                        log.responseBody = response.data.body;

                        if (typeof(log.responseHeaders["Content-Type"]) != "undefined" && log.responseHeaders["Content-Type"].length > 0 && log.responseHeaders["Content-Type"][0].match(/image\//)) {
                            log.previewImageURL = log.requestScheme + "://" + log.host + log.requestURI;
                        }
                    })
                    .done(function () {
                        log.previewImageLoaded = true;
                    });
            } else {
                if (typeof(log.responseHeaders["Content-Type"]) != "undefined" && log.responseHeaders["Content-Type"].length > 0 && log.responseHeaders["Content-Type"][0].match(/image\//)) {
                    log.previewImageURL = log.requestScheme + "://" + log.host + log.requestURI;
                }
                log.previewImageLoaded = true;
            }
        }

        // 响应内容
        else if (tabName == "responseBody") {
            // @TODO
        }

        // Cookie
        else if (tabName == "cookie") {
            if (typeof(log.cookies) == "undefined") {
                this.$get(".cookies." + log.id)
                    .success(function (response) {
                        log.cookies = response.data.cookies;
                        log.countCookies = response.data.count;
                    });
            }
        }

        // 终端信息
        else if (tabName == "client") {
            var client = log.extend.client;

            // 操作系统信息
            var osVersion = client.os.family;
            if (osVersion.length == 0 || osVersion == "Other") {
                log.osVersion = "";
            } else {
                if (client.os.major.length > 0) {
                    osVersion += " " + client.os.major;
                }
                if (client.os.minor.length > 0) {
                    osVersion += "." + client.os.minor;
                }
                if (client.os.patch.length > 0) {
                    osVersion += "." + client.os.patch;
                }
                if (client.os.patchMinor.length > 0) {
                    osVersion += "." + client.os.patchMinor;
                }
                log.osVersion = osVersion;
            }

            // 浏览器信息
            var browserVersion = client.browser.family;
            if (browserVersion.length == 0 || browserVersion == "Other") {
                log.browserVersion = "";
            } else {
                if (client.browser.major.length > 0) {
                    browserVersion += " " + client.browser.major;
                }
                if (client.browser.minor.length > 0) {
                    browserVersion += "." + client.browser.minor;
                }
                if (client.browser.patch.length > 0) {
                    browserVersion += "." + client.browser.patch;
                }
                log.browserVersion = browserVersion;
            }

            // 地理位置信息
            var geo = log.extend.geo;
            var geoAddr = geo.region + " " + geo.state;
            if (![geo.city, geo.city + "市", geo.city + "州"].$contains(geo.state)) {
                geoAddr += " " + geo.city;
            }
            log.geoAddr = geoAddr.trim();

            if (log.geoAddr.length > 0) {
                [1].$loop(function (k, v, loop) {
                    var mapBoxId = "map-box-" + log.id;
                    if (document.getElementById(mapBoxId) == null) {
                        setTimeout(function () {
                            loop.next();
                        }, 100);
                        return;
                    }
                    var map = new BMap.Map("map-box-" + log.id);
                    var decoder = new BMap.Geocoder();
                    decoder.getPoint(log.geoAddr, function (point) {
                        if (point == null) {
                            point = new BMap.Point(geo.location.longitude, geo.location.latitude);
                            var converter = new BMap.Convertor();
                            converter.translate([point], 3, 5, function (data) {
                                if (data.status == 0) {
                                    point = data.points[0];
                                }

                                var marker = new BMap.Marker(point, {
                                    icon: new BMap.Icon("/images/poi.png", new BMap.Size(20, 20), {
                                        anchor: new BMap.Size(10, 20),
                                        imageSize: new BMap.Size(20, 20)
                                    })
                                });
                                map.addOverlay(marker);
                                map.centerAndZoom(point, 5);
                            });
                        } else {
                            var marker = new BMap.Marker(point, {
                                icon: new BMap.Icon("/images/poi.png", new BMap.Size(20, 20), {
                                    anchor: new BMap.Size(10, 20),
                                    imageSize: new BMap.Size(20, 20)
                                })
                            });
                            map.addOverlay(marker);
                            map.centerAndZoom(point, 5);
                        }
                    });
                });
            }
        }

        log.tabName = tabName;
        this.$set(this.logs, index, log);
    };

    this.pause = function () {
        this.isPlaying = !this.isPlaying;

        if (this.isPlaying) {
            this.loadLogs();
        }
    };

    this.bodyFetching = false;
    this.startBodyFetching = function () {
        this.bodyFetching = !this.bodyFetching;
    };
});