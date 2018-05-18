'use strict';

const { Component, h, render } = window.preact;
const firebse = window.firebase;


// CONFIG

var deck_url       = "bit.ly/uwdc2018", 
    last_question  = null,
    slides_prefix  = "../jpegs/",
    slides         = ["100.jpg", "110.jpg", "112.jpg", "114.jpg", "116.jpg", "118.jpg", "120.jpg", "130.jpg", "132.jpg", "134.jpg", "136.jpg", "138.jpg", "140.jpg", "150.jpg", "210.jpg", "220.jpg", "230.jpg", "240.jpg", "250.jpg", "260.jpg", "270.jpg", "280.jpg", "290.jpg", "300.jpg", "310.jpg", "320.jpg", "330.jpg", "332.jpg", "334.jpg", "336.jpg", "340.jpg", "350.jpg", "360.jpg", "363.jpg", "365.jpg", "367.jpg", "380.jpg", "390.jpg", "395.jpg", "400.graph.jpg", "405.stats.jpg", "410.jpg", "420.jpg", "440.jpg", "445.jpg", "450.jpg", "460.time.jpg", "470.jpg", "480.jpg", "490.jpg", "500.jpg", "510.jpg", "520.jpg", "530.jpg", "540.jpg", "580.jpg", "590.jpg", "600.jpg", "610.jpg", "620.jpg", "630.jpg"],
    slides_ratio = 16/9,
    slides_loaded = 0,
    slides_failed = 0;


// DATABASE

firebase.initializeApp(
  { apiKey:            "AIzaSyBSvbyk9BAbG0b0EY9-uRu97ms-0GP1hfI",
    authDomain:        "slides-551fe.firebaseapp.com",
    databaseURL:       "https://slides-551fe.firebaseio.com",
    projectId:         "slides-551fe",
    storageBucket:     "slides-551fe.appspot.com",
    messagingSenderId: "483497773461" });

var database = firebase.database(),
    $root = database.ref("1805_UWDC");


// CURRENT SLIDE

var current_slide_idx = 0,
    last_idx          = slides.length - 1;


function change_slide(delta) {
  var new_idx = Math.max(0, Math.min(last_idx, current_slide_idx + delta));
  if (new_idx !== current_slide_idx) {
    current_slide_idx = new_idx;
    rerender();
  }
}


// PRESENCE

var online    = 0,
    connected = false,
    $online   = $root.child("online");


database.ref('.info/connected').on("value", (s) => {
  if (s.val()) {
    connected = true;
    rerender();
  } else
    connected = false;
    rerender();
});


$online.on("child_added", (_s) => { online++; rerender(); });
$online.on("child_removed", (_s) => { online--; rerender(); });


// COUNTER

var counter = 0,
    $counter = $root.child("counter_naive"),
    counter_cas = 0,
    $counter_cas = $root.child("counter_cas"),
    $oplog = $root.child("oplog"),
    last_to = 0,
    setback = 0,
    setback_str = "",
    conflicts = 0,
    uncorrected_offsets = [],
    corrected_offsets = [],
    counter_history = [],
    counter_cas_history = [];

$counter.on("value", (s) => { if (s.val()) { counter = s.val(); rerender(); }});
$counter_cas.on("value", (s) => { if (s.val()) { counter_cas = s.val(); rerender(); }});

$oplog.orderByChild("server_time").on("child_added", function(s) {
  var op = s.val();
  if (last_to !== op.from) {
    conflicts += 1;
  }
  if (last_to - op.to > setback) {
    setback = last_to - op.to;
    setback_str = last_to + " → " + op.to; 
  }
  uncorrected_offsets.push((op.local_time - op.server_time)/1000);
  corrected_offsets.push((op.corrected_time - op.server_time)/1000);
  counter_history.push({t: op.server_time, v: op.to, op: op});
  counter_cas_history.push({t: op.server_time, v: counter_cas_history.length + 1});
  last_to = op.to;
  rerender();
});


// VIEW

var app, render_pending = false;


function rerender() {
  if (!render_pending) {
    requestAnimationFrame(() => { render_pending = false; app.forceUpdate(); });
    render_pending = true;
  }
}

const StatSlide = () => {
  return h("table", { class: "stats" },
           h("tr", {}, h("th", {}, "Counter Naїve"),   h("td", {}, counter)),
           h("tr", {}, h("th", {}, "Conflicts"),       h("td", {}, conflicts)),
           h("tr", {}, h("th", {}, "Biggest setback"), h("td", {}, setback_str + " (−" + setback + ")")),
           h("tr", {}, h("th", {}, "Counter CAS"),     h("td", {}, counter_cas)));
}

function distribute_thresholds(from, to, ticks) {
  var res = [];
  for (var x = from; x <= to; x += (to-from)/ticks) {
    res.push(x);
  }
  return res;
}

class Graph extends Component {
  componentDidMount() { this.redraw(); }
  componentDidUpdate() { this.redraw(); }
  render(props) {
    return h("svg", { id: props.id, class: "graph", width: deck_width, height: deck_height });
  }
  redraw() {
    if (this.props.data.length < 1) return;
    var svg = d3.select("svg#" + this.props.id),
        data = this.props.data,
        _ = svg.selectAll("*").remove(),
        width = svg.attr("width") - 100,
        height = svg.attr("height") - 100, 
        g = svg.append("g").attr("transform", "translate(50,50)"),
        x = d3.scaleLinear().rangeRound([0, width]).domain([data[0].t, data[data.length-1].t]),
        y = d3.scaleLinear().rangeRound([height, 0]).domain(this.props.range);
    g.append("path")
      .data([data])
      .attr("class", "line")
      .attr("d", d3.line().x(d=>x(d.t)).y(d=>y(d.v)));
    g.append("g").call(d3.axisLeft(y));
    g.append("g").attr("transform", "translate(0," + height + ")")
     .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%H:%M:%S")));

  }
}

class GraphSlide extends Component {
  render(props) {
    var max_v = Math.max(d3.max(counter_history, d=>d.v),
                         d3.max(counter_cas_history, d=>d.v));
    return h("div", {}, 
             h(Graph, { id: "naive", data: counter_history, range: [0, max_v] }),
             h(Graph, { id: "cas", data: counter_cas_history, range: [0, max_v] })
    );
  }
}


class Histogram extends Component {
  componentDidMount() { this.redraw(); }
  componentDidUpdate() { this.redraw(); }
  render(props) {
    return h("svg", { id: props.id, class: "time_stats", width: deck_width-30, height: deck_height * 0.5 - 25 });
  }
  redraw() {
    var svg = d3.select("svg#" + this.props.id),
        data = this.props.data,
        _ = svg.selectAll("*").remove(),
        width = svg.attr("width") - 20,
        height = svg.attr("height") - 40, 
        g = svg.append("g").attr("transform", "translate(10,20)"),
        formatCount = d3.format(",.0f"),
        x = d3.scaleLinear().domain([-this.props.range, this.props.range]).rangeRound([0, width]),
        ticks = 101,
        thresholds = distribute_thresholds(-this.props.range, this.props.range, ticks),
        bins = d3.histogram().domain(x.domain()).thresholds(thresholds)(data),
        rect_width = width/ticks - 2,
        y = d3.scaleLinear().domain([0, d3.max(bins, function(d) { return d.length; })]).range([height, 0]),
        bar = g.selectAll(".bar")
              .data(bins)
              .enter()
              .append("g")
              .attr("class", "bar")
              .attr("transform", d=>"translate(" + x(d.x0) + "," + y(d.length) + ")");
    
    bar.append("rect").attr("x", 1)
      .attr("width", rect_width)
      .attr("height", function(d) { return height - y(d.length); });
    g.selectAll(".text").data(bins).enter().append("text")
      .attr("dy", ".75em")
      .attr("y", -15)
      .attr("x", rect_width / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#c33")
      .attr("transform", d=>"translate(" + x(d.x0) + "," + y(d.length) + ")")
      .text(function(d) { return d.length > 0 ? formatCount(d.length) : ""; });
    g.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).ticks(31));
  }
}

const TimeSlide = () => {
  if (uncorrected_offsets.length > 0 && corrected_offsets.length > 0) {
    var range = Math.max(Math.abs(d3.min(uncorrected_offsets)),
                        Math.abs(d3.max(uncorrected_offsets)),
                        Math.abs(d3.min(corrected_offsets)),
                        Math.abs(d3.max(corrected_offsets)));
    return h("div", {},
            h(Histogram, { id: "uncorrected", data: uncorrected_offsets, range: range }),
            h("div", { class: "time-label" }, "Uncorrected offsets"),
            
            h(Histogram, { id: "corrected", data: corrected_offsets, range: range }),
            h("div", { class: "time-label" }, "Corrected offsets"))
  }
}

class Slide extends Component {
  constructor() {
		super();
		this.state = { visible: false,
                   loaded: false };
	}
  load() {
    var img = new Image();
    img.onload = () => { this.loaded = true; slides_loaded++; rerender(); };
    img.onerror = () => { this.loaded = true; slides_failed++; rerender(); };
    img.src = slides_prefix + slides[this.props.pos];
    this.state.image = img;
  }
  is_visible() {
    return this.props.pos === current_slide_idx - 1 ||
           this.props.pos === current_slide_idx     || 
           this.props.pos === current_slide_idx + 1;
  }
  componentWillMount() {
    this.load();
    this.componentWillUpdate();
  }
  componentWillUpdate() {
    if (this.is_visible())
      this.setState({ visible: true });
  }
  render(props, state) {
    var cls = props.pos < current_slide_idx ? "slide_exit" :
              props.pos > current_slide_idx ? "slide_enter" :
                                              "slide_current",
        src = this.is_visible() || state.visible ? "url(" + slides_prefix + props.slide + ")" : "";
    return h('div', {class: "slide " + cls, 
                     id:    "slide_" + props.pos,
                     style: { backgroundImage: src }},
             /graph/.test(props.slide) ? h(GraphSlide) : null,
             /stats/.test(props.slide) ? h(StatSlide) : null,
             /time/.test(props.slide) ? h(TimeSlide) : null,);
  }
  componentDidUpdate() {
    if (this.state.visible && !this.is_visible())
      setTimeout(() => this.setState({ visible: false }), 1000);
  }
}


var screen_width,
    screen_height,
    deck_width,
    deck_height,
    statusbar_height = 40;


function resize(_event) {
  screen_width = document.documentElement.clientWidth;
  screen_height = document.documentElement.clientHeight - statusbar_height;
  [deck_width, deck_height] = screen_width / slides_ratio > screen_height
    ? [screen_height * slides_ratio, screen_height]
    : [screen_width, screen_width / slides_ratio];
  rerender();
}


class Deck extends Component {
  componentWillMount() {
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("keydown", handle_keyboard);
  }

  render(props, state) {
    return h("div", { class: "deck", 
                      style: { width:  deck_width, 
                               height: deck_height, 
                               left:   (screen_width - deck_width) / 2,
                               top:    statusbar_height + (screen_height - deck_height) / 2 }},
             slides.map((name, pos) => {
               return h(Slide, { key: name, slide: name, pos: pos });}))
  }

  componentWillUnmount() {
    window.removeEventListener("resize", resize);
    document.removeEventListener("keydown", handle_keyboard);
  }
}

const GoBack = () => {
  return current_slide_idx === 0 ? null :
    h("div", { key: "go_back", 
               class: "go go_back",
               style: { width:  (screen_width - deck_width) / 2 + deck_width * 0.33333333,
                        top:    statusbar_height + (screen_height - deck_height) / 2,
                        height: deck_height },
               onclick: () => change_slide(-1) });
}


const GoForward = () => {
  return current_slide_idx >= last_idx ? null :
    h("div", { key: "go_forward",
               class: "go go_forward",
               style: { width:  (screen_width - deck_width) / 2 + deck_width * 0.33333333,
                        top:    statusbar_height + (screen_height - deck_height) / 2,
                        height: deck_height },
               onclick: () => change_slide(1) });
}


const Counter = (props) => {
  var value = "" + props.value,
      str = "000000".substring(0, 6 - value.length) + value;
  
  return h("div", { class: "status-counter" }, str.split("").map( c => h("span", {}, c)));
}

const StatusBar = (props) => {
  return h("div", { class: "status" },
           h("span", { class: "status-url" }, h("a", {href:"http://" + deck_url, target: "_blank"}, deck_url)),
           h("div",  { class: connected ? "status-online" : "status-offline" }, "" + online),
           Counter({value: counter})
           
          //  , h("div",  { class: "status-slide" }, slides[current_slide_idx])
        );
}


function handle_keyboard(e) {
  switch(e.keyCode) {
    case 34: // page down
    case 32: // space
    case 39: // right
    case 40: // down
      change_slide(1);
      e.preventDefault();
      break;
    case 33: // page up
    case 37: // left
    case 38: // up
      change_slide(-1);
      e.preventDefault();
      break;
  }
}


function sort_by(arr, keyfn1, keyfn2) {
  return arr.sort(function(a,b) {
    return keyfn1(a) > keyfn1(b) ? -1 : keyfn1(a) < keyfn1(b) ? 1 : keyfn2(a) > keyfn2(b) ? -1 : keyfn2(a) < keyfn2(b) ? 1 : 0;
  });
}


// PRELOADER

const Message = (props, state) => {
  return h("div", { class: "loader" },
           h("span", { class: "loader-inner" },
             props.children));
}


const PreloadStatus = (props) => {
  if (slides_loaded + slides_failed < slides.length)
    return h("div", { class: "progress" },
            h("div", { class: "progress-inner",
                        style: { width: ((slides_loaded + slides_failed) / slides.length * 100) + "%" } }));
}


class App extends Component {
  componentDidMount() {
    window.app = this;
  }
  render(props, state) {
    return h("div", { class: "app app_deck" }, 
              h(Deck),
              h(GoBack),
              h(GoForward),
              h(StatusBar),
              h(PreloadStatus));
  }
}

render(h(App), document.querySelector(".mount"));