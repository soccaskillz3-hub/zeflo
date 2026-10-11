// Runs in <head>, before the page first appears, to put the scene's theme, time of day and
// weather on <html> straight away (the scene itself fills in after it loads). Safari on iPhone
// colours the strip behind the status bar from the page's first paint and doesn't look again on
// pages that don't scroll (the clock, the timer), so that first paint has to be the real scene.
//
// It uses the scene shown last time, if that was within the last half hour (the time of day and
// weather can't be known yet otherwise), and the saved choices and the clock if not (with the same default sunrise and sunset as
// timeOfDay in weather.ts). Must stay in step with SceneProvider (scene.tsx) and its storage keys.

export const SCENE_KEY = "studyflow:scene";

export const SCENE_SCRIPT = `(function(){try{
var d=document.documentElement,s=localStorage;
var times=["sunrise","day","dusk","night"],weathers=["clear","cloudy","rain","storm","snow","fog"];
var last=JSON.parse(s.getItem("${SCENE_KEY}")||"null");
var fresh=last&&Date.now()-last.at<1800000;
var theme=fresh&&(last.theme==="ocean"||last.theme==="forest")?last.theme:s.getItem("studyflow:theme");if(theme!=="ocean"&&theme!=="forest")theme="ocean";
var time=s.getItem("studyflow:time-override");
if(times.indexOf(time)<0){
if(fresh&&times.indexOf(last.time)>=0)time=last.time;
else{var n=new Date(),m=n.getHours()*60+n.getMinutes();
time=m>=345&&m<465?"sunrise":m>=465&&m<1080?"day":m>=1080&&m<1185?"dusk":"night";}
}
var weather=s.getItem("studyflow:weather-override");
if(weathers.indexOf(weather)<0)weather=fresh&&weathers.indexOf(last.weather)>=0?last.weather:"clear";
d.dataset.theme=theme;d.dataset.time=time;d.dataset.weather=weather;
}catch(e){}})();`;
