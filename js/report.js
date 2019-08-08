/*
 * API
 *
 * use dataviz parameter in url to filter report by dataviz id.
 * eg ?dataviz=viz_1 or ?dataviz=viz_1,viz_2
 * id data source contains many items (item1, item2...),
 * use dataid in config.json.
 *
 */
report = (function() {
    /*
     * Private
     */

	var _rawReport = null;

	var _reportName = "";

    var _router = null;

    var _config;

    var APIRequest = {};

    var _home = "reports/";

    var errors = false;

    var _data;

    var _format = function(value) {
        if (!isNaN(value)) {
            return parseFloat(value).toLocaleString();
        } else {
            return value;
        }
    }

    var _alert = function(msg, alert, show) {
        $("body").prepend('<div class="report-alert alert alert-' + alert + '" role="alert">' + msg + '</div>');
        errors = true;
        if (show) {
            $(".report-alert").show();
        }
    };

    var  _deleteElement = function (id) {
        $("#" + id).remove();
    };

    var _handleVizError = function(el, id, data) {
        var error_msg = "";
        if (el) {
            error_msg = "erreur " + id + "\n pas de données pour cette dataviz";
        } else if (data[id]) {
            error_msg = "erreur " + id + "\n Elément html manquant";
        } else {
            error_msg = "erreur " + id + "\n Elément html et données manquants pour cette dataviz";
        }
        _alert(error_msg, "warning", false);
    }

    var _getCss = function() {
        $('head').prepend('<link rel="stylesheet" href="' + _home + "report.css" + '" type="text/css" />');
    };

    var _init = function() {
        //API GET PARAMETERS
        _router = new Navigo(document.location.origin + '/mreport/', false);
        _router
          .on({
                '/': function () {
                    $("body").append('<h4>Sélectionnez un rapport ex: </h4><a href="sample">sample</a>');
                    errors = true;
                },
                '/:report': function (params) {
                    APIRequest = params;
                    _home += params.report + "/";
                },
                '/:report/:dataid': function (params) {
                    APIRequest = params;
                    _home += params.report + "/";
                },
                '/:report/:dataid/:dataviz': function (params) {
                    APIRequest = params;
                    _home += params.report + "/";
                },

            })
          .resolve();
          console.log(APIRequest);
        _router.notFound(function () {
          // called when there is path specified but
          // there is no route matching
          console.log("erreur de route");
        });

        Chart.plugins.unregister(ChartDataLabels);



        if (!errors) {
            /* get config file*/
            $.ajax({
                dataType: "json",
                url: _home + "config.json",
                success: function(conf) {
                    _config = conf;
                    _config.dataviz = APIRequest.dataviz;
                    _getDom();
                    _getCss();
                },
                error: function(xhr, status, err) {
                    _alert("Erreur avec le rapport " + _home + " " + err, "danger", true);
                }
            });
        }

    };

    /**
     * Overwrites a's values with b's and adds b's if non existent in a
     * @param a
     * @param b
     * @returns c a new object based on a and b
     */

    var _merge_element_properties = function (a,b) {
        var c = {};
        for (var attrname in a) { c[attrname] = a[attrname]; }
        for (var attrname in b) { c[attrname] = b[attrname]; }
        return c;
    };

    var _updateElementsConf = function (a, b) {
        var c = [];
        if (Array.isArray(a)) {
            a.forEach(function (a_element) {
                if (Array.isArray(b)) {
                    var b_element = b.filter(function(element) {
                        return element.id === a_element.id
                    });
                    if (b_element.length === 1) {
                        c.push(_merge_element_properties(a_element, b_element[0]));
                    } else {
                        c.push(a_element);
                    }
                } else {
                    c.push(a_element);
                }

            });
        }
        if (Array.isArray(b)) {
            b.forEach(function (b_element) {
                // find all elements not present in a
                if (Array.isArray(a)) {
                    var a_element = a.filter(function(element) {
                        return element.id === b_element.id
                    });
                    if (a_element === 0) {
                        c.push(b_element);
                    }
                }
            });
        }
        return c;
    };

    var _cast_properties = function (element, item) {
        var properties = {
            "id": item.id
        };
        if (element === "chart") {
            if (item.label) {
                if (item.label.indexOf(",") > 0) {
                    properties["label"] = item.label.split(",");
                } else {
                    properties["label"] = item.label;
                }
            }
            if (item.colors && !Array.isArray(item.colors)) {
                properties["colors"] = item.colors.split(",");
            }
            if (item.type) {
                properties["type"] = item.type;
            }
            if (item.opacity) {
                properties["opacity"] = parseFloat(item.opacity);
            }


        } else if (element === "table") {
            if (item.label && !Array.isArray(item.label)) {
                properties["label"] = item.label.split(",");
            }
            if (item.extracolumn) {
                properties["extracolumn"] = item.label;
            }
            if (item.columns && !Array.isArray(item.columns)) {
                properties["columns"] = item.columns.split(",").map(function(value) {
                    return Number(value) - 1;
                });
            }

        } else if (element === "map") {
            if (item.zoom) {
                properties["zoom"] = Number(item.zoom);
            }
        } else {
            console.log(element, item);
        }

        return properties;
    };

    var _merge_config = function() {
        //Principe: la conf peut provenir du html via les attributs data- et ou du fichier config.json
        // Si deux propriétés différentes sont paramétrées dans le html et le json, les 2 propriétés sont conservées.
        // si une même propriété est paramétrée dans le html et le json, seule la propriété du json est conservée.
        var dom = {};
        ["figure", "image", "text", "iframe", "title", "chart", "table", "map"].forEach(function(element) {
            // pas de conf pour ces éléments, il faut juster renseigner l'id
            dom[element] = $(".report-" + element).toArray();
            //Récupération des éléments report-figure, report-title ...
            //avec un id renseigné
            if (dom[element].length > 0) {
                var html_conf = dom[element].map(function(item) {
                    return _cast_properties(element, $.extend($(item).data(), {
                        "id": item.id
                    }));
                });
                //Récupération de la conf pour chaque type d'élément via le config.json
                //eg charts:[...]
                var json_conf = _config[element + "s"];
                if (element === "title") {
                    _config[element] = html_conf[0];
                } else {
                    if (!json_conf) {
                        _config[element + "s"] = [];
                        json_conf = _config[element + "s"];
                    }
                }
            } else {
                // no element with id
            }
            _config[element + "s"] = _updateElementsConf(html_conf, json_conf);
        });

        console.log("CONFIGURATION", _config);

    };


    var _getDom = function() {
        $.ajax({
            url: _home + "report.html",
            dataType: "text",
            success: function(html) {
				_rawReport = {"name": _reportName, "html": html};
                if (APIRequest.dataviz && $(html).find("#" + APIRequest.dataviz).length > 0) {
                    var block = ['<div class="report container-fluid filtered">',
                    $(html).find("#" + APIRequest.dataviz).prop('outerHTML'),
                    '</div>'].join("");
                    $("body").append(block);
                    $(".alert").remove();
                    _config.share = false;
                } else {
                    $("body").append(html);
                }
                //append _config
                _merge_config();
                _getData();
            },
            error: function(xhr, status, err) {
                _alert("Erreur avec le fichier report.html de " + _home + " " + err, "danger", true);
            }
        });
    };

    var _parseCSV = function(csv) {
        var tmp = Papa.parse(csv, {
            header: true
        });
        return _mergeJSON(tmp.data);
    };

    var _mergeJSON = function(obj) {
        var json = {};
        var result = {};
        obj.forEach(function(raw, id) {
            /* ecriture d'un nouvel objet json de la forme {ecluse1: {chart1: {data:[1,2,3], label:[v1,v2,v3]}, chart2: {...}}}
            Si plusieurs datasets présents data est de la forme data: [[dataset1], [dataset2]] --> [[1,2,3], [4,5,6]]*/
            // merge dataid, dataviz, dataset
            if (json[raw.dataid]) {
                // test dataviz
                if (json[raw.dataid].dataviz[raw.dataviz]) {
                    // test dataset
                    if (json[raw.dataid].dataviz[raw.dataviz].dataset[raw.dataset]) {
                        json[raw.dataid].dataviz[raw.dataviz].dataset[raw.dataset].data.push(raw.data);
                        json[raw.dataid].dataviz[raw.dataviz].dataset[raw.dataset].label.push(raw.label);
                    } else {
                        //creation du dataset et alimentation data et label
                        json[raw.dataid].dataviz[raw.dataviz].dataset[raw.dataset] = {
                            label: [raw.label],
                            data: [raw.data]
                        };
                    }

                } else {
                    // new dataviz
                    json[raw.dataid].dataviz[raw.dataviz] = {
                        "dataset": {}
                    };
                    //creation du dataset et alimentation data et label
                    json[raw.dataid].dataviz[raw.dataviz].dataset[raw.dataset] = {
                        label: [raw.label],
                        data: [raw.data]
                    };

                }
            } else {
                if (raw.dataid) {
                    // new dataid
                    json[raw.dataid] = {
                        "dataviz": {}
                    };
                    //creation du dataviz
                    json[raw.dataid].dataviz[raw.dataviz] = {
                        "dataset": {}
                    };
                    //creation du dataset et alimentation data et label
                    json[raw.dataid].dataviz[raw.dataviz].dataset[raw.dataset] = {
                        label: [raw.label],
                        data: [raw.data]
                    };
                }

            }
        });



        // merge data and labels for each dataset
        $.each(json, function(dataid, a) {
            result[dataid] = {};
            $.each(a.dataviz, function(dataviz, b) {
                var significative_labels = true;
                result[dataid][dataviz] = {
                    "label": [],
                    "data": [],
                    "dataset": [],
                    "rows": 0,
                    "significative_label": null
                };
                ndataset = 0;
                $.each(b.dataset, function(dataset, c) {
                    ndataset += 1;
                    var rows = c.data.length;
                    if (significative_labels) {
                        var distinct_labels = [];
                        c.label.forEach(function(label) {
                            if (!distinct_labels.includes(label)) {
                                distinct_labels.push(label);
                            }
                        });
                        if (distinct_labels.length < rows) {
                            significative_labels = false;
                        }
                    }

                    result[dataid][dataviz].data.push(c.data);
                    result[dataid][dataviz].label.push(c.label);
                    result[dataid][dataviz].dataset.push(dataset);
                    result[dataid][dataviz].significative_label = significative_labels;
                    result[dataid][dataviz].rows = rows;

                });
                if (ndataset === 1) {
                    result[dataid][dataviz].data = result[dataid][dataviz].data[0];
                    result[dataid][dataviz].label = result[dataid][dataviz].label[0];
                }
                //result[dataid][dataviz].label = result[dataid][dataviz].label[0];
            });

        });


        return result;

    };


    var _getData = function() {
        var request_parameters = {};
        request_parameters[_config.dataid] = APIRequest.dataid;
        _config.data_other_parameters.forEach(function(parameter) {
            if (APIRequest[parameter]) {
                request_parameters[parameter] = APIRequest[parameter];
            }
        });
        // test url (relative or absolute)
        var url = "";
        if (/^(?:[a-z]+:)?\/\//i.test(_config.data_url)) {
            url = _config.data_url;
        } else {
            url = _home + _config.data_url;
        }

        var format = "json";
        if (_config.data_format === "csv") {
            format = "text";
        }

        $.ajax({
            dataType: format,
            url: _home + _config.data_url,
            data: request_parameters,
            success: function(data) {
                if (format === "text") {
                    data = _parseCSV(data);
                } else if (format === "json" && data) {
                    data = _mergeJSON(data);
                }
                if (!APIRequest.dataid) {
                    var links = [];
                    Object.keys(data).forEach(function(a) {
                        links.push('<li><a href="'+APIRequest.report+'/' + a +'">'+a+'</a></li>');
                    });
                    $(".report, .alert").remove();
                    $("body").append(['<ul>', links.join(""), '</ul>']);
                    return;
                }


                data = data[APIRequest.dataid];
                _data = data;

                if (data && typeof data === 'object' && Object.getOwnPropertyNames(data).length > 0) {
                    report.drawViz(data);
                    if (_config.title && data[_config.title.id]) {
                        report.setTitle(data[_config.title.id].label);
                    }
                } else {
                    var msg = "absence de données " + _config.data_url + " : " + request_parameters[_config.dataid];
                    _alert(msg, "warning", true);
                }

            },
            error: function(xhr, status, error) {
                var msg = "erreur " + _config.data_url + " : " + error;
                _alert(msg, "danger", true);
            }
        });
    };

    const hexToRgb = hex =>
        hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
        .substring(1).match(/.{2}/g)
        .map(x => parseInt(x, 16))



    var _setTitle = function(title) {
        document.getElementsByClassName("report-title")[0].textContent = title;
        document.title = title;
    };

    var _createChart = function(data, chart) {
        var el = _getDomElement("chart", chart.id);
        if (el && data[chart.id]) {
            var commonOptions = {
                "maintainAspectRatio": false
            };
            var colors = ["#36A2EB"];
            var backgroundColors = []
            var borderColors = [];
            if (chart.colors.length > 0) {
                colors = chart.colors;
            }
            colors.forEach(function(color) {
                backgroundColors.push('rgba(' + hexToRgb(color).join(',') + ',' + (chart.opacity || 0.5) + ')');
                borderColors.push('rgba(' + hexToRgb(color).join(',') + ', 1)');
            });
            var datasets = [];
            var _labels;
            // test if one or many datasets
            if (Array.isArray(data[chart.id].data[0])) {
                // many datasets
                var _datasets = data[chart.id].data;
                var _labels = data[chart.id].label[0];
                _datasets.forEach(function(dataset, id) {
                    datasets.push({
                        label: chart.label[id],
                        data: dataset,
                        backgroundColor: backgroundColors[id],
                        borderColor: borderColors[id]
                    });
                });


            } else {
                // one dataset
                _labels = data[chart.id].label;
                if (colors.length === 1) {
                    backgroundColors = backgroundColors[0];
                    borderColors = borderColors[0];
                }
                datasets.push({
                    label: chart.label,
                    data: data[chart.id].data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors
                });
            }

            $(el).prepend('<canvas id="' + chart.id + '-canvas" width="400" height="200"></canvas>');
            var options = $.extend({}, commonOptions, chart.options);
            var plugins = [];
            if (chart.plugins && chart.plugins[0] === "ChartDataLabels") {
                plugins = [ChartDataLabels];
            }
            var ctx = document.getElementById(chart.id + "-canvas").getContext('2d');
            var chart = new Chart(ctx, {
                type: chart.type || 'bar',
                data: {
                    labels: _labels,
                    datasets: datasets
                },
                plugins: plugins,
                options: options
            });
        } else {
            _handleVizError(el, chart.id, data);
        }
    };

    var _createFigure = function(data, chiffrecle) {
        var el = _getDomElement("figure card", chiffrecle.id);
        var unit = $(el).attr("data-unit") || "";
        if (el && data[chiffrecle.id]) {
            el.getElementsByClassName("report-figure-chiffre")[0].textContent = _format(data[chiffrecle.id].data[0]) + unit;
            if (el.getElementsByClassName("report-figure-caption").length > 0) {
                el.getElementsByClassName("report-figure-caption")[0].textContent = data[chiffrecle.id].label[0];
            }
        } else {
            _handleVizError(el, chiffrecle.id, data);
        }
    };

    var _createTable = function(data, table) {
        var el = _getDomElement("table", table.id);
        if (el && data[table.id] && table.label) {
            // construction auto de la table
            var columns = [];
            var datasets_index = [];
            if (table.columns && table.columns.length > 0) {
                datasets_index = table.columns;

            } else {
                data[table.id].dataset.forEach(function(element, id) {
                    datasets_index.push(id);
                });
            }
            console.log(datasets_index);
            if (table.extracolumn) {
                columns.push('<th scope="col">' + table.extracolumn + '</th>');
            }
            table.label.forEach(function(col, id) {
                columns.push('<th scope="col">' + col + '</th>');
            });

            var data_rows = [];
            // Use first colun data to collect other columns data
            data[table.id].data[0].forEach(function(value, id) {
                var values = [];
                if (table.extracolumn) {
                    // on prends les labels corrspondant au premier dataset
                    // todo vérifier que ce sont les mêmes labels pour tous les datasets
                    values.push(data[table.id].label[0][id]);
                }
                datasets_index.forEach(function(dataset_index, cid) {
                    values.push(_format(data[table.id].data[dataset_index][id]));
                });
                data_rows.push(values);
            });

            rows = [];
            data_rows.forEach(function(row, id) {
                var elements = [];
                row.forEach(function(column) {
                    elements.push('<td>' + column + '</td>');
                });
                rows.push('<tr>' + elements.join("") + '</tr>');

            });

            var html = ['<table class="table table-bordered">',
                '<thead class="thead-light">',
                '<tr>' + columns.join("") + '</tr></thead>',
                '<tbody>' + rows.join("") + '</tbody></table>'
            ].join("");

            $(el).append(html);

        } else {
            _handleVizError(el, table.id, data);
        }
    };

    var _createText = function(data, text) {
        var el = _getDomElement("text", text.id);
        if (el && data[text.id]) {
            el.getElementsByClassName("report-text-text")[0].textContent = data[text.id].data[0];
            el.getElementsByClassName("report-text-title")[0].textContent = data[text.id].label[0];
        } else {
            _handleVizError(el, text.id, data);
        }
    };

    var _createImage = function(data, image) {
        var el = _getDomElement("image", image.id);
        if (el && data[image.id]) {
            $(el).append('<img src="' + data[image.id].data[0] + '" class="img-fluid" alt="' + data[image.id].label[0] + '">');
        } else {
            _handleVizError(el, image.id, data);
        }
    };

    var _createIframe = function(data, iframe) {
        var el = _getDomElement("iframe", iframe.id);
        if (el && data[iframe.id]) {
            var html = '<iframe class="embed-responsive-item" src="' + data[iframe.id].data[0] + '"></iframe>';

            $(el).append(html);
        } else {
            _handleVizError(el, iframe.id, data);
        }
    };

    var _getDomElement = function(classe, id) {
        var el = document.getElementById(id);
        return el;
    }

    var parseWKT = function (wkt) {
        var lonlat = [0, 0];
        // find data beetween ()
        //var regExp = /\(([^)]+)\)/;
        // regex get all numeric values
        var a = /[-+]?\d+(?:\.\d*)?/gi
        if (wkt.match(a)) {
            lonlat = wkt.match(a).map(Number);
            console.log(lonlat);
        }
        return lonlat;
    };

    var _createMap = function(data, map) {
        var el = _getDomElement("map", map.id);
        var id = map.id + "-map";
        $(el).append('<div id="' + id + '" style="width:auto;height:300px;"><div>');
        var zoom = map.zoom || false;
        var datasets_nb = data[map.id].dataset.length;
        var points_nb = data[map.id].rows;
        var layers = [];
        var points = [];
        var labels = [];
        var all_points = [];
        var icons = [];
        var center = [48, 0];
        if (datasets_nb === 1) {
            // une typologie de points
            icons.push(L.divIcon({
                className: 'map-marker-circle-1',
                iconSize:[30, 30]
            }));
            //un ou plusieurs points
            points = [];
            labels = [];
            data[map.id].data.forEach(function(pt) {
                //points.push(pt.split("@").map(Number));
                points.push(parseWKT(pt).reverse());
            });
            data[map.id].label.forEach(function(label) {
                labels.push(label);
            });
            layers.push({
                "points": points,
                "labels": labels,
                "icon": icons[0]
            });
            all_points.push(points);

        } else {
            // Plusieurs typologies de points
            data[map.id].dataset.forEach(function(dataset, id) {
                icons.push(L.divIcon({
                    className: 'map-marker-circle-' + (id + 1),
                    iconSize:[30, 30]
                }));
                 //un ou plusieurs points
                points = [];
                labels = [];
                data[map.id].data[id].forEach(function(pt) {
                    //points.push(pt.split("@").map(Number));
                    points.push(parseWKT(pt).reverse());
                });
                data[map.id].label.forEach(function(label) {
                    labels.push(label);
                });
                layers.push({
                    "points": points,
                    "labels": labels,
                    "icon": icons[id]
                });
                all_points.push(points);
            });
        }
        var _map = L.map(id);
        _map.zoomControl.remove();
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(_map);
        layers.forEach(function(layer, idlayer) {
            layer.points.forEach(function (point, id) {
                if (datasets_nb === 1) {
                    label = layer.labels[id];
                } else {
                    label = layer.labels[idlayer][id];
                }
                var marker = L.marker(point, {icon: layer.icon}).addTo(_map).bindPopup(label);
            });

        });

        _map.fitBounds(all_points);
        if (zoom) {
            _map.setZoom(zoom);
        }

    };

    var _testViz = function(data, type, properties) {
        switch (type) {
            case "chart":
                _createChart(data, properties);
                break;
            case "table":
                _createTable(data, properties);
                break;
            case "figure":
                _createFigure(data, properties);
                break;
            case "text":
                _createText(data, properties);
                break;
            case "image":
                _createImage(data, properties);
                break;
            case "iframe":
                _createIframe(data, properties);
                break;
            case "map":
                _createMap(data, properties);
                break;
        }
    };


    var _drawViz = function(data) {
        /* Listing des données non valorisées dans ce rapport  */

        $.each(data, function(id) {
            var vizs = ["charts", "figures", "texts", "maps", "images", "iframes", "tables", "title"];
            var used = false;
            vizs.forEach(function(viz) {
                if (viz === "title") {
                    if (_config[viz] && _config[viz].id === id) {
                        used = true;
                    }
                } else {
                    if (_config[viz] && _config[viz].filter(function(item) {
                            return item.id === id
                        }).length > 0) {
                        used = true;
                    }
                }
            });
            if (!used && !_config.dataviz) {
                console.log(id + " n'est pas utilisé dans ce rapport");
            }


        });

        /* Création des chiffres clés */
        if (_config.figures) {
            _config.figures.forEach(function(dvz) {
                if (data && dvz.id && data[dvz.id]) {
                    _createFigure(data, dvz);
                } else {
                    // no data
                    _deleteElement(dvz.id);
                }
            });
        }

        /* Création des charts */
        if (_config.charts) {
            _config.charts.forEach(function(dvz) {
                if (data && dvz.id && data[dvz.id]) {
                    _createChart(data, dvz);
                 } else {
                    // no data
                    _deleteElement(dvz.id);
                }
            });
        }

        if (_config.tables) {
            //ATTENTION POUR LES TABLEAUX, 1 DATASET est le contenu d'une colonne.
            _config.tables.forEach(function(dvz) {
                if (data && dvz.id && data[dvz.id]) {
                    _createTable(data, dvz);
                 } else {
                    // no data
                    _deleteElement(dvz.id);
                }
            });
        }

        if (_config.texts) {
            _config.texts.forEach(function(dvz) {
                if (data && dvz.id && data[dvz.id]) {
                    _createText(data, dvz);
                 } else {
                    // no data
                    _deleteElement(dvz.id);
                }
            });
        }
        if (_config.images) {
            _config.images.forEach(function(dvz) {
                if (data && dvz.id && data[dvz.id]) {
                    _createImage(data, dvz);
                 } else {
                    // no data
                    _deleteElement(dvz.id);
                }
            });
        }

        if (_config.iframes) {
            _config.iframes.forEach(function(dvz) {
                if (data && dvz.id && data[dvz.id]) {
                    _createIframe(data, dvz);
                 } else {
                    // no data
                    _deleteElement(dvz.id);
                }
            });
        }

        if (_config.maps) {
            _config.maps.forEach(function(dvz) {
                if (data && dvz.id && data[dvz.id]) {
                    _createMap(data, dvz);
                 } else {
                    // no data
                    _deleteElement(dvz.id);
                }
            });
        }

        if (_config.share) {
            $.ajax({
                url: "html/share.html",
                dataType: "text",
                success: function(html) {
                    $("body").append(html);
                    $(".report-chart, .report-table, .report-text, .report-image, .report-map, .report-group, .report-figure.sharable").prepend('<button type="button" class="report-share btn btn-outline-info" data-toggle="modal" data-target="#share-panel">Partager</button>');
                    $(".report-share").click(function(e) {
                        var el = $(e.currentTarget).parent();
                        var obj = [];
                        if (el.hasClass("report-group")) {
                            el.find(".report-group-item").toArray().forEach(function(item) {
                                obj.push(item.id);
                            });
                        } else {
                            obj.push($(e.currentTarget).parent().attr("id"));
                        }
                        var url = $(location).attr('href') + "/" + obj.join(",");

                        $(".report-share-info").attr("href", url);

                        var iframe = ['<div style="position:relative;display:block;height:0;',
                            'padding:0;overflow:hidden;padding-bottom:50%;">',
                            '<iframe style="position:absolute;top:0;bottom:0;',
                            'left:0;width:100%;height:100%;border:0;"',
                            'src="' + url + '"></iframe></div>'
                        ].join("\n");

                        $(".report-share-iframe").text(iframe);
                    });
                }
            });

        }

        if (_config.wizard || APIRequest.wizard) {
            wizard.init(_data);
        }

        if (errors && _config.debug) {
            $(".report-alert").show();
        }

        $(".report").fadeTo("slow", 1);

    };

    /*
     * Public
     */

    return {

        drawViz: _drawViz,
        testViz: _testViz,
        setTitle: _setTitle,
		getReport: function () {return _rawReport;},
        init: _init
    }; // fin return

})();

$(document).ready(function() {
    report.init();
});
$(window).load(function() {
    $('#preloader').fadeOut('slow', function() {
        $(this).remove();
    });
});