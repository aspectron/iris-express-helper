var _ = require('underscore');

function IRISExpressHelper(core, options) {

    return function(req, res, next) {
        var iris = {
            _meta: {},
            _js:{},
            _inlineJs:{},
            _css:{},
            _inlineCss:{},
            _combineCacheQuery:{js:{}, css:{}},
            _options:{jsAtHead: 0},
            debug: false,
            meta: function(meta){
                _.extend(this._meta, meta);
            },
            print: function(names, key, spacer){
                names = names.split(",");
                var list = [], me = this, s;
                _.each(names, function(name){
                    name = name.split("|");
                    me.debug && console.log("print--> name[0], key::", name[0], key || name[1])
                    s = me._print(name[0], key || name[1], name[2]);
                    if (!s)
                        return;
                    list.push(s)
                });
                return list.join(spacer || "\n\t");
            },
            title: function (title) { this.meta({title: title}) },
            charset: function (charset) { this.meta({charset: charset}) },
            canonical: function (canonical) { this.meta({canonical: canonical}) },
            shortlink: function (shortlink) { this.meta({shortlink: shortlink}) },
            description: function (description) { this.meta({description: description}) },
            keywords: function (keywords) { this.meta({keywords: keywords}) },
            viewport: function (viewport) { this.meta({viewport: viewport}) },
            xuacompatible: function (content) { this.meta({"x-ua-compatible": content}) },
            htmlEntities: function(str) {
                return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g,'&apos;');
            },
            urlEncode: function(str){
                var me = this;
                //return encodeURI(str);
                if (me._urlEncodeChars){
                    var chars = me._urlEncodeChars;
                    str = String(str);
                    for(var i=0; i< chars.length; i++) {
                        str = str.replace(chars[i].s, chars[i].r);
                        //console.log("s", str, chars[i].s, chars[i].r)
                    }

                    return str;
                }
                me._urlEncodeChars = [];
                //var testArray = [];
                for(var i=0;i<256;i++) {
                    var c = String.fromCharCode(i);
                    var c2 = c;
                    if(encodeURI(c) !== c && c != "%") {
                        if (["[", "]", "}", "{", ".", "\\", "^", "*", "+", "?", "|"].indexOf(c2) != -1){
                            c2 = '\\'+c2;
                        }
                        me._urlEncodeChars.push({
                            s: new RegExp(c2, "g"),
                            r: encodeURI(c)
                        });
                        /*
                        testArray.push({
                            character:c,
                            encodeURI:encodeURI(c),
                            encodeURIComponent:encodeURIComponent(c)
                        });
                        */

                    }
                }
                //console.log("me._urlEncodeChars", me._urlEncodeChars)
                return me.urlEncode(str);
            },
            printMeta: function(spacer){
                spacer = spacer || "\n\t";
                var list = [], me = this, key;
                _.each(this._meta, function(v, k){
                    key = k.toLowerCase();
                    if (key == "canonical" || key == "shortlink"){
                        v = me.urlEncode(v);
                    }else{
                        v = me.htmlEntities(v);
                        k = me.htmlEntities(k);
                    }
                    switch(key){
                        case "title": return list.push('<title>'+v+'</title>');
                        case "charset": return list.push('<meta charset="'+v+'">');
                        case "canonical":
                        case "shortlink":
                            return list.push('<meta rel="'+k+'" href="'+v+'" />');
                        case "description":
                        case "keywords":
                        case "viewport":
                            return list.push('<meta name="'+k+'" content="'+v+'" />');
                        case "x-ua-compatible":
                            return list.push('<meta http-equiv="'+k+'" content="'+v+'" />');
                        default:
                            list.push('<meta property="'+k+'" content="'+v+'" />');
                        break;
                    }
                });
                return list.join(spacer);
            },
            defineMeta: function(meta){
                this._meta = _.extend(meta, this._meta);
            },
            defineOptions: function (options) {
                this._options = _.extend(options, this._options);
            },
            options: function (options) {
                _.extend(this._options, options);
            },
            cacheQuery: function (query, key, type) {
                key = key || "header";
                type = type || "js";
                query = query || "?cache=0";
                this._combineCacheQuery[type][key] = query;
            },
            inlineScript: function(content, priority, key){
                this._add("inlineJs", key, content, priority);
            },
            inlineCss: function(content, priority, key){
                this._add("inlineCss", key, content, priority);
            },
            css: function(path, priority, key){
                this._add("css", key, path, priority);
            },
            script: function(path, priority, key){
                this._add("js", key, path, priority);
            },
            printInlineScript: function(key, spacer){
                return this._print("inlineJs", key, spacer);
            },
            printInlineCss: function(key, spacer){
                return this._print("inlineCss", key, spacer);
            },
            printScript: function(key, spacer){
                return this._print("js", key, spacer);
            },
            printCss: function(key, spacer){
                return this._print("css", key, spacer);
            },
            _add: function(type, key, content, priority){
                key = key || "header";
                var list = this["_"+type];
                if (!list)
                    throw new Error("Invalid iris._add("+type+", ..)");
                priority = priority || 0;
                if(!list[key])
                    list[key] = [];

                list[key].push({c:content, p:priority});
            },
            _opt: function (name, defaultValue) {
                if(_.isUndefined(this._options[name]))
                    return defaultValue;
                return this._options[name];
            },
            _print: function(type, key, spacer){
                var me = this;
                me.debug && console.log("_print1-->type,key::", type, key)
                if(type == "meta")
                    return this.printMeta(spacer);

                key = key || "header";
                var _type = type.replace("-", "").toLowerCase();
                if (_type == "script"){
                    type = "js";
                }else if (_type == "inlinecss"){
                    type = "inlineCss";
                }else if (_type == "inlinejs" || _type == "inlinescript"){
                    type = "inlineJs";
                }

                if ( type == "inlineJs" || type == "js" ) {
                    var jsAtHead = this._opt('jsAtHead', 0);
                    if(key == "header" && jsAtHead===false ) {
                        return "";
                    }else if(key == "footer" && jsAtHead===true ){
                        return "";
                    }
                    if (jsAtHead===false && key == "footer")
                        key = "header";
                }
                var list = this["_"+type];
                me.debug && console.log("_print3-->type,_type,list::", type, _type, list)
                if (!list)
                    return "";

                var items = list[key];
                if (!items || !items.length)
                    return "";
                items = _.sortBy(items, function (a) {
                    return -a.p;
                });
                if (type == "inlineCss" || type== "inlineJs") {
                    items = _.map(items, function (a) {
                        return a.c;
                    });
                }
                //console.log("items", type, items)
                var c = [], f;
                var combineable = [];
                switch(type){
                    case "inlineCss": return '<style>'+items.join(spacer || "\n")+'</style>';
                    case "inlineJs": return '<script>'+items.join(spacer || "\n")+'</script>';
                    case "js":
                        me.debug &&  console.log("_print-->c1::",c)
                        _.each(items, function(item){
                            f = me.urlEncode(item.c)
                            if ( f[0] =="/" || f.indexOf("http") === 0 || f.indexOf(".js") > 0 ){
                                c.push('<script src="'+f+'"></script>');
                                return
                            }
                            combineable.push(f);
                        });
                        if (combineable.length){
                            c.push('<script src="/combine:js:'+combineable.join(";").replace(/\//g, ":") + (this._combineCacheQuery.js[key] ? this._combineCacheQuery.js[key] : "") +'"></script>');
                        }

                        me.debug &&  console.log("_print-->c2::",c)
                    break;
                    case "css":
                        _.each(items, function(item){
                            f = me.urlEncode(item.c)
                            if ( f[0] =="/" || f.indexOf("http") === 0 || f.indexOf(".css") > 0 ){
                                c.push('<link rel="stylesheet" type="text/css" href="'+f+'" />');
                                return
                            }
                            combineable.push(f);
                        });
                        if (combineable.length){
                            c.push('<link rel="stylesheet" type="text/css" href="/combine:css:'+combineable.join(";").replace(/\//g, ":")+ (this._combineCacheQuery.css[key] ? this._combineCacheQuery.css[key] : "") +'" />');
                        }
                    break;
                }
                return c.join(spacer || "\n\t");
            }
        }
        res.locals.iris = iris;
        next()
    }
}

module.exports = IRISExpressHelper;