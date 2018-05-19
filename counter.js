'use strict';

const { Component, h, render } = window.preact;
const firebse = window.firebase;


var app, render_pending = false;

function rerender() {
  if (!render_pending) {
    requestAnimationFrame(() => { render_pending = false; app.forceUpdate(); });
    render_pending = true;
  }
}


var GEN_ID_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';


function gen_id() { 
  var now = new Date().getTime(),
      id  = "";
  for (var i = 7; i >= 0; i--) {
    id = GEN_ID_CHARS.charAt(now % 64) + id;
    now = Math.floor(now / 64);
  }
  for (i = 0; i < 12; i++) {
    id += GEN_ID_CHARS.charAt(Math.floor(Math.random() * 64));
  }
  return id;
}


// USER

var user_id = localStorage.getItem("user_id");
if (!user_id) {
  user_id = gen_id();
  localStorage.setItem("user_id", user_id);
}
console.log("user_id =", user_id);


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


// PRESENCE

var connected = false,
    $online   = $root.child("online");

database.ref('.info/connected').on("value", (s) => {
  if (s.val()) {
    $online.child(user_id).set(true);
    $online.child(user_id).onDisconnect().remove();
    connected = true;
    rerender();
  } else
    connected = false;
    rerender();
  });

// CLOCK SKEW

var clock_skew = 0;
database.ref(".info/serverTimeOffset").on("value", (s) => clock_skew = s.val());


// COUNTER

var counter = 0,
    fetching = true,
    $counter_naive = $root.child("counter_naive"),
    $counter_cas = $root.child("counter_cas"),
    $oplog = $root.child("oplog");
$counter_naive.on("value", (s) => { 
  if (s.val()) {
    fetching = false;
    counter = s.val();
    document.title = "[ " + counter + " ] Counter";
    rerender();
}});


// VIEW

const Offline = () => {
  if (!connected)
    return h("div", { class: "counter-status-offline" })
}

const Counter = (props) => {
  var value = "" + props.value,
      str = "000000".substring(0, 6 - value.length) + value;
  
  return h("div", { class: "counter" }, h(Offline), str.split("").map( c => h("span", {}, c)));
}


class Button extends Component {
  render (props, state) {
    return h("svg", { class: "counter-button" + (state.pressed ? " counter-button_pressed" : ""),
                      width: 250,
                      height: 250,
                      viewBox: "0 0 100 100",
                      onclick: () => {
                        if (!connected || fetching) return;
                        this.setState({pressed: true});
                        $oplog.push().set({
                          from:           counter,
                          to:             counter+1,
                          local_time:     new Date().getTime(),
                          corrected_time: new Date().getTime() + clock_skew,
                          server_time:    firebase.database.ServerValue.TIMESTAMP
                        });
                        counter++;
                        $counter_naive.set(counter);
                        $counter_cas.transaction(x => x + 1);
                        setTimeout(() => this.setState({pressed: false}), 100) }},
              h("circle", { cx: 50, cy: 50, r: 45, fill: "none" }),
              h("line", { x1: 20, y1: 50, x2: 80, y2: 50 }),
              h("line", { x1: 50, y1: 20, x2: 50, y2: 80 })
            );
  }
}


class App extends Component {
  componentDidMount() {
    window.app = this;
  }
  render(props, state) {
    return h("div", { class: "app" }, h(Counter, {value: counter}), h(Button));
  }
}

render(h(App), document.querySelector(".mount"));