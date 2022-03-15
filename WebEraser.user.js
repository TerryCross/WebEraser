// ==UserScript==
// @name        WebEraser
// @version     1.7.4
// @updateURL   https://openuserjs.org/meta/slow!/WebEraser.meta.js
// @downloadURL https://openuserjs.org/install/slow!/WebEraser.user.js
// @namespace   sfswe
// @description Erase parts of any webpage --annoyances, logos, ads, images, etc., permanently with just, Ctrl + Left-Click.
// @license     GPL-3.0-only
// @copyright   2018, slow! (https://openuserjs.org/users/slow!)
// @include     *
// @require     https://code.jquery.com/jquery-3.2.1.js
// @require     https://code.jquery.com/ui/1.12.1/jquery-ui.js
// @require     https://raw.githubusercontent.com/SloaneFox/code/master/sfs-utils-0.1.6.js
// @run-at      document-start
// @icon        https://raw.githubusercontent.com/SloaneFox/imgstore/master/WebEraserIcon.gif
// @author      Sloane Fox
// @grant       GM_registerMenuCommand
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_xmlhttpRequest
// @grant       GM_getResourceURL
// @grant       GM_addStyle
// @grant       GM.registerMenuCommand
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM.deleteValue
// @grant       GM.listValues
// @grant       GM.xmlHttpRequest
// @grant       GM.getResourceUrl
// ==/UserScript==

var gobj, preferences;

main();

async function main() {
	[gobj, preferences] = initGlobalObjects();
	profileTimer("w/e start");
	await listenForPageLoad();
}

async function listenForPageLoad() {
	if(gobj.iframe)
		installEventHandlers();
	else {
		await userscriptManagerInit();
		profileTimer("preMain-half");
		await loadResources();
	}
}

async function loadResources() {                 //attempt to get in at document-start, either preload of js or of images slows page load too much.  However, eval of js files will not help.
	await getUserPreferences();
	await attachToPage();
	const haveNothingToErase = (gobj.elems_to_be_erased == "" && !gobj.nonGMmode);
	if(haveNothingToErase) 
		console.log("WebEraser, nothing to erase.");
	else 
		await loadAndListen();
}

async function loadAndListen() {
	await loadLazyResources();                    ///////////// loadLazyResources loads @require files.
	const domIsLoaded = (/^complete/.test(document.readyState));
	if(domIsLoaded) 
		performErasures();
	else
		document.addEventListener("readystatechange", performErasures());        //main(); addEventListener("load", main.bind(environ))	; // In a normal GM environment, main will be called at docready.
}

async function attachToPage() {
	profileTimer("preMain()-inited globs");
	installEventHandlers();
	await registerCommands();
}

async function getUserPreferences() { 
	preferences.page_erasedElems = (await getValue(gobj.webpage+":erasedElems","")).trim();
	preferences.site_erasedElems = (await getValue(gobj.website+":erasedElems","")).trim();
	preferences.config = await getValue("config",{keepLayout:"checked", monitor:{}});
	if (!preferences.config.monitor) preferences.config.monitor = {};
	gobj.elems_to_be_erased = getErasedElemsCmd();
}

async function performErasures() { try{
	profileTimer("main()-start");
	//console.log("w/e main GM:", typeof GM, "readyState", document.readyState,"body:", document.body,"iframe", gobj.iframe,"jQuery:", window.jQuery&&window.jQuery.fn.jquery,"$", window.$);
	inner_eraseElements("init");
	const nerased = $(".Web-Eraser-ed").length, delay = 5000+300*(2+nerased), forErasure = getErasedElemsCmd("count");
	tryAgain(delay, nerased);    // Try again to look for elements to erase after for page to complete loading.
	profileTimer("main()-end");
} catch(e){console.error("WebEraser main(), error:", e);}} //main()

function tryAgain(delay, nerased) {
	setTimeout( x=> { 
		//console.log("End of", delay,"delay, checking for inner_eraseElements", preferences.page_erasedElems,"or", preferences.site_erasedElems);
		performErasuresPhaseTwo(delay);
		installEventHandlers("phase2"); // for iframes that delay in loading.
		profileTimer("end delayed phase2");
	}, delay);
} 

function performErasuresPhaseTwo(delay) {
	profileTimer("start of phase 2 "+delay+"ms later ");
	const haveElsToErase = (preferences.page_erasedElems || preferences.site_erasedElems);
	if(haveElsToErase) 
		inner_eraseElements("delay"); 
	else if ($(".Web-Eraser-ed").length == 0 && gobj.elems_to_be_erased)
		console.info("WebEraser message: no match for any selectors:", getErasedElemsCmd(),"\nWebpage:", gobj.webpage);
}

async function loadLazyResources() { try{ // called from main and form click handler, completes main when have els to erase.
	if(loadLazyResources.done) return; loadLazyResources.done = true;
	profileTimer("loadLazyResources()-start");
	insertPrototypes();
	await dynamicLoadRequires();  // sets log()
	await init_async_globs(); // depends on load of js polyfill file on FF for 'GM.' funcs.
	register_jQandCmds();
} catch(e){console.error("WebEraser loadLazyResources(), error:", e);}} //loadLazyResources()

function register_jQandCmds(){
	registerCommands(); 
	ensure_jquery_extended(); // may get clobbered by other script loading jQ.
	addStyle();
	setTimeout(reattachTornCurtains, 3000);
	gobj.sel_matching_els = $();
	profileTimer("loadLazyResources()-end");
}

function addStyle() {
	GM_addStyle( jqueryui_dialog_css()        
				 +".sfswe-transparentborder  { border-color:transparent !important;border-width:"+gobj.border_width+"px !important;border-style:double !important; } "
				 +".sfswe-redborder { border-color:red !important; border-width:"+gobj.border_width+"px !important;border-style:double !important; } " 
				 +"img.WebEraserCurtain { display: block !important; color:#fff !important; }"
				 +`.CurtainRod {
	background-color: #bbb; background-image: linear-gradient(90deg, rgba(255, 255, 255,.07) 50%, transparent 50%), linear-gradient(90deg, rgba(255, 255, 255,.13) 50%, transparent 50%), linear-gradient(90deg, transparent 50%, rgba(255, 255, 255,.17) 50%), linear-gradient(90deg, transparent 50%, rgba(255, 255, 255,.19) 50%); background-size:  13px, 19px, 17px, 15px; }` +".ui-dialog-buttonpane button {color:black !important;}" + 'img[src*="blob:"] { display:block !important; }'); 
}

async function handleClick(e, click_from_nested_iframe) { 
	//console.log("handleClick", e, click_from_nested_iframe);
	const itsaCtrlClick = (e.ctrlKey && ! e.shiftKey && !e.altKey &&! e.metaKey && e.type == "mousedown");
	if (itsaCtrlClick || click_from_nested_iframe) {
		prevDef(e);
		if(!gobj.iframe) await loadLazyResources();
		console.log("ctrl-CLICKed on element:", e.target,"Event:", e);
		processClickTarget(e, click_from_nested_iframe);
	}
}

function processClickTarget(e, click_from_nested_iframe) {		
	console.log("processClickTarget");
	const target = e.target, related = e.explicitOriginalTarget||e.relatedTarget;
	if(/body/i.test(e.target.tagName) && related) 
		target = related;
	userIOtoEraseElement(target, e, click_from_nested_iframe);
}

function userIOtoEraseElement(target, e, click_from_nested_iframe) { try { //called from event handler in page & iframe, and pseudo called from click within iframe.
	halter(); // to handle an unload
	const frameEl = target.ownerDocument.defaultView.frameElement;
	if(frameEl) 
		target = frameEl;
	if(!postUpTheMsg(target, click_from_nested_iframe)) 
		respondToClickTargetType(target, e);
} catch(e) { console.log("W/e Click handling error:", e,"\nLineNumber:"+(e.lineNumber),"Stack:", e.stack); unhalt(); }}  //handleClick() 

function postUpTheMsg(target, click_from_nested_iframe) {
	if(click_from_nested_iframe) 
		return;  // pseudo call from postMessage.
	const seltext_len = window.getSelection().toString().length;
	return sendToIframeParent(target, seltext_len);
}

function sendToIframeParent(target, seltext_len){	
	if (seltext_len != 0) { 
		unhalt(); 
		return true; 
	}
	if (target.blur) 
		target.blur();
	if (gobj.iframe)  {
		window.parent.postMessage( { type:"sfswe-iframe-click", code:0, src:location.toString() },"*"); // msg, origin makes pseudo call back here.
		unhalt(); 
		return true;
	}
}

function respondToClickTargetType(target, e){
	while (/HTMLUnknownElement/.test(target.toString())) 
		target = target.parentNode; //Avoid non HTML tags.
	eraseTargetElement(target, e);
	if(!halter.dialog) 
		unhalt();
}

function eraseTargetElement(target, e){
	console.log("eraseTargetElement");
	if(!gobj.tempMode) 
		askUserToConfirm(target, e);
	else 
		doTempErasure(target);
}

function askUserToConfirm(target, e) {
	if ($(target).is(".WebEraserCurtain") && !gobj.tempMode) 
		confirmUserFullErasure(target, e);
	else if (!gobj.tempMode)
		if(!bodyClick(target, e)) 
			confirmUserErasure(target);
}

function confirmUserFullErasure(target, e) {
	if (e.button == 0) {
		const reply = confirm("This will completely erase selected item, continue? \nOn any revisit to webpage you can check in the console for such erasures.");
		if (reply) openCurtains("zap", $(target).siblings("img").addBack());
	} else
		erasurePreferences();
}

function confirmUserErasure(target) {
	halter.dialog = true;
	inner_eraseElements();
	const prom = checkIfPermanentRemoval(target);
	prom.then(respondToUserRequest);
	prom.catch(function (a){ unhalt();halter.dialog = false;});
}

function respondToUserRequest(confirm_val){     // then takes a function with 2 params, the arg of resolve func call and of reject.
	const [permrm, item_sel] = confirm_val;
	halter.dialog = false;
	unhalt();
	if (permrm == Infinity)     // sprompt returns Infinity for when extra button (3rd) is clicked.  temp-mode delete
		startTempMode(item_sel);
	if (permrm != false)       
		inner_eraseElements("click");           //undefined==>escape (cancel)
};

function bodyClick(target, e) {
	if ($("body").is(target)) {
		console.log("Click was on element,", target,"Event:", e);
		if (confirm("WebEraser.  You clicked on the main body of the webpage.  The body however, is not removable by ctrl-click, try ctrl-clicking on an image or other item on the webpage.  Hit 'OK' to open erasure window."))
			erasurePreferences();
		unhalt();
		return true;
	}
}
function startTempMode(item_sel) {
	gobj.tempMode = true; 
	alert("\tYou have entered Temporary-Deletion mode.\n\tCtrl-click will now merely remove elements temporarily.\n\nEsc to undo deletions.  Reload to revert.  Element deleted.");
	doTempErasure(item_sel);
	escapeCatch(undoDelete,"perm");
} 

function doTempErasure(target) {
	const t = $(target);
	if( ! t.is("body")) {
		gobj.last_ones_deleted.push(t);  
		t.replaceWith("<placeholder delcnt = "+(++gobj.delcnt)+">");
		console.info("Temp-mode deleting:", t, t.text());
	}
}

function undoDelete() {
	if(gobj.delcnt == 0) return;
	const L = gobj.last_ones_deleted.pop(), p = $("placeholder[delcnt = "+gobj.delcnt--+"]");
	p.replaceWith(L); 
	console.log("replaced holder with new", L[0]);
	L[0].scrollIntoView();
}

function halter() {	
	window.addEventListener("beforeunload", handlehalt);
}

function handlehalt(event) {
	event.returnValue = "a  message to stay";
	return event.returnValue;
};

function unhalt(){ 	
	window.removeEventListener("beforeunload", handlehalt, false);
}

function prehitch(target) {         // hitch up hierarchy if click is on element that cannot be red-bordered.
	const svg = target.closest("svg");          // DOM method dom-Elem.closest("sel1, sel2, ...").  Also method matches("sels");
	if(svg) target = svg; 
	return target; 
}

function checkIfPermanentRemoval(target) {   // called from click handler & eraseIframe.
	var sconfirm_promise, checkif_resolve, checkif_reject;
	const checkif_promise = new Promise((resolve, reject) => {      // checkif_promise is returned by this function, checkIfPermanentRemoval().
		checkif_resolve = resolve; checkif_reject = reject;
		sconfirm_promise = openErasureConfirmation(target);
	});//new Promise()
	close_of_prompt(sconfirm_promise, checkif_resolve, checkif_reject);
	return checkif_promise;
}

function close_of_prompt(sconfirm_promise, checkif_resolve, checkif_reject) {
	sconfirm_promise.catch(function(reply){
		hlightAndsetsel(0,"off","restore");
		checkif_reject("caught");
	});
	sconfirm_promise.then(handleUserReply.bind(null, {sconfirm_promise, checkif_resolve, checkif_reject}));
}

function handleUserReply(bpkt, reply){ 
	const {sconfirm_promise, checkif_resolve, checkif_reject} = bpkt;
	$(document).off('keypress');
	$(":data(pewiden-trace)").data("pewiden-trace",""); // remove trace
	const complete_rm_ticked = $("#sfswe-checkbox6:checked").length != 0;
	const webpage_only_ticked = $("#sfswe-checkbox7:checked").length != 0;
	const temp_del_mode_ticked = $("#sfswe-checkbox10:checked").length != 0;
	const reply_sel = finishedConfirmation(reply, temp_del_mode_ticked, checkif_resolve);
	if(reply_sel !== false){
		sconfirm_promise.data = [reply_sel, complete_rm_ticked]; // use ES6 await?
		registerSelectorForErasure(reply_sel, checkif_reject, webpage_only_ticked, complete_rm_ticked, checkif_resolve);
	}
};

function finishedConfirmation(reply, temp_del_mode_ticked, checkif_resolve, reply_sel){
	if( temp_del_mode_ticked && reply) {
		hlightAndsetsel(0,"off","restore"); 
		checkif_resolve([Infinity, $("#sfswe-seledip").val().trim()]);  // Infinity means 3rd button which was for gobj.tempMode.
		return false;
	}
	if(reply != false) 
		reply_sel = $("#sfswe-seledip").val().trim(); 

	if(reply!=true) { 
		hlightAndsetsel(0,"off","restore"); 
		checkif_resolve([reply, reply_sel]); 
		return false; 
	};
	return reply_sel;
}

function registerSelectorForErasure(reply_sel, checkif_reject, webpage_only, complete_rm, checkif_resolve){
	if (reply_sel)  {
		const ancErased = $(reply_sel).closest(".Web-Eraser-ed");  //.closest, includes current.
		if(!checkSelectorBadAncestry(reply_sel, ancErased, checkif_reject)) 
			updateErasedElementsLists(webpage_only, reply_sel, complete_rm, checkif_resolve, checkif_reject);
	} else noSelector(checkif_reject);	
}

function noSelector(checkif_reject){
	hlightAndsetsel(0,"off","restore"); 
	checkif_reject("empty");
}

function checkSelectorBadAncestry(reply_sel, ancErased, checkif_reject){
	if (erasedElementsListCmd("isthere?", reply_sel) || 
		(ancErased.length && getErasedElemsCmd("match el", ancErased))){ 
		alert("Already attempting erasure of the element specified or parent, if not being erased properly try "+"ticking the monitoring option or open 'Erase Web Elements' GM menu and hit its 'OK' button.\nInternal code:"+reply_sel+"\n\n   Ancestor:"+nodeInfo(ancErased)); 
		console.info("Already erasing", ancErased, nodeInfo(ancErased),".  Your selector", reply_sel);
		hlightAndsetsel(0,"off","restore");
		checkif_reject("Ancestor Already");
		return true; 
	}
}

function updateErasedElementsLists(webpage_only, reply_sel, complete_rm, checkif_resolve, checkif_reject) {
	if (!webpage_only)	
		erasedElementsListCmd("add", reply_sel+" site");
	else 
		erasedElementsListCmd("add", reply_sel);    // btn1 -> null, btn2 -> "<string>" null == undefined
	
	if (erasedElementsListCmd("rm", $(reply_sel).find(".Web-Eraser-ed"))) 
		console.info("Removed child selectors of", reply_sel);
	finishedDialog(complete_rm, reply_sel, checkif_resolve);

}

function finishedDialog(complete_rm, reply_sel, checkif_resolve){
	hlightAndsetsel(0,"off","restore");
	if (complete_rm) 
		preferences.zaplists.add(reply_sel);
	checkif_resolve([true, reply_sel]);
}

function openErasureConfirmation(target){
	target = prehitch(target);
	const userMsg = gobj.permanentErasureUserMessage;
	$(document).keypress(keypressHandler);
	
	const tooltip = gobj.permanentErasureUserTooltip; 
	const s_prom = sconfirm(userMsg,"Cancel","OK", null, tooltip); 
	const dialog = s_prom.dialog; // dialog is classed .ui-dialog.
	//function addClickBoxesXpath(dialog, target);
	
	appendPermCheckboxes(dialog);
	makePreferencesClickable(dialog);
	handleXpathInputDisplay(dialog, target);
	return s_prom;
}

function appendPermCheckboxes(dialog) {
	const buttonpane = dialog.find(".ui-dialog-buttonpane");
	buttonpane.append("<div><input id=sfswe-checkbox7 type=checkbox style='vertical-align:middle'>"
					  +"<label style='display:inline'>&nbsp;&nbsp;Remove just from this page (not entire website).</label></div>");
	buttonpane.append("<br><div style='margin-top:-10px;float:left;'><input id=sfswe-checkbox6 type=checkbox style='vertical-align:middle'>"	
					  +"<label style='display:inline;'>&nbsp;&nbsp;Completely delete element.</label></div>");
	buttonpane.append("<br><div style='margin-top:-10px;'><input id=sfswe-checkbox10 type=checkbox style='margin-left:30px;vertical-align:middle'>"	
					  +"<label style='display:inline;' "
					  +"title='Temporary-Deletion mode means that when ctrl-click is pressed it will now quickly delete any element on the page.  "
					  +"However, the deletion is temporary and when the page is reloaded all is restored and ctrl-click will then behave as before.'>&nbsp;&nbsp;Enter Temporary-Deletion mode.</label></div>");
}
function makePreferencesClickable(dialog){
	dialog.find(".sfs-link").click( e => {
		dialog.trigger($.Event("keydown",{keyCode:27, key:"Escape"})); // close prompt and open Prefs dialog.
		erasurePreferences();
	});
}

function handleXpathInputDisplay(dialog, target) {
	const input = $("#sfswe-seledip"), ip = input[0], div_surround = input.next();
	div_surround.click( e=> {                                               // a click on input & surround enables it.
		ip.disabled = false; 	    ip.setSelectionRange(999, 999);
		div_surround.css("display","none");
		input.focus();
		input.blur(e => {ip.disabled = true; div_surround.css("display",""); });
	}); //
	hlightAndsetsel(target); // Also sets input value to selector!
	setTimeout(function(){dialog[0].scrollIntoView();}, 100);
}

async function eraseIframe() {
	await loadLazyResources();
	if(!await sconfirm("\nTo erase a page element, click OK below, then place and leave the mouse hovering over the chosen element for 6 seconds."
					   +"\n\nThis function is used when ctrl-click does not work.  "
					   +"Certain items visible on the page, eg, Iframes cannot be clicked.  "
					   +"Clicking on them results in a new page opening.  ")) return;
	var current_hover_targ;
	window.addEventListener("mouseover", moverScan, false);

	function moverScan(e){ 
		current_hover_targ = e.target;
		//		if(/iframe/i.test(e.target.tagName)) {
		setTimeout(function(prev_targ){
			if(prev_targ == current_hover_targ) {
				window.removeEventListener("mouseover", moverScan, false);
				userIOtoEraseElement(e.target, e);
			}
		}, 6000, current_hover_targ);
	} 
}

async function erasurePreferences() { 
	// Called from GM script command menu (Preferences...) and from clickable within ctrl-click  prompt.
	// 
	await loadLazyResources();
	const erasedElems = getErasedElemsCmd("with site");
	const no_sels = !erasedElems ? 0 : erasedElems.split(/,/).length;
	//	"See checkboxes distantly below to set the script's configutation values."
	openPrefsPrompt(no_sels, erasedElems);
}

function openPrefsPrompt(no_sels, erasedElems){
	const prompt_promise = sprompt(
		"<span style='padding:0;'>Usage:</span><br>Whilst holding down the Control key, make a mouse click on the "
			+"webpage&mdash;after quitting this dialogue.  That will open a dialog to confirm the erasure.  "
			+"\n\nOn some elements however, ctrl-click is absorbed.  In that case choose from this script's "
			+"menu:&nbsp; <span class=sfs-link>Erase via mouse hover....</span>"
			+"\n\nBelow find an editable, comma-separated list of each deleted element.  "
			+"Below that see the preferences' checkboxes.\n"
			+"\n"+( no_sels ? "Currently there "+(no_sels == 1 ? "is ":"are ")
					+no_sels+" below.  " : "No element is being deleted.")+"\n\n"
		, erasedElems.replace(/,/g,", \n"));
	prompt_promise.then(getCheckboxValues);
	adaptDialog(prompt_promise.dialog);
}

async function getCheckboxValues([btn, reply_text]){ 
	if (!btn) return;   //btn is null when Cancel is hit, true for OK, undefined when Escape. (null is == to undefined!)
	preferences.config = {monitor:preferences.config.monitor}; 
	delete preferences.config.monitor[gobj.website];
	if ($("#sfswe-checkbox:checked").length)	preferences.config.noAnimation = "checked";
	if ($("#sfswe-checkbox2:checked").length)	preferences.config.keepLayout = "checked";
	if ($("#sfswe-checkbox3:checked").length) 	preferences.config.hideCurtains = "checked";
	if ($("#sfswe-checkbox5:checked").length)   preferences.config.monitor[gobj.website] = "checked";
	if ($("#sfswe-checkbox9:checked").length) 	await exportImportScriptData();
	else if ($("#sfswe-checkbox4:checked").length) setOwnCurtains();
	else savePreferences(reply_text);

};//getCheckboxValues()

function adaptDialog(dialog){	
	const keep_layout = preferences.config.keepLayout;
	
	dialog.find(".ui-dialog-buttonpane").prepend(
		"<div class=sfswe-ticks style='float:left;font-size:10px;'>" //width:78%;
			+"<input id=sfswe-checkbox2 type=checkbox style='float:left;vertical-align:middle;"+(!keep_layout?" margin:0 3px;":"")+"' "+keep_layout+">&nbsp;<label>Preserve layout (in general).</label>"
			+(keep_layout ? "<input id=sfswe-checkbox3 type=checkbox style='vertical-align:middle;margin:0 3px 0 10px;height:12px;'"+(preferences.config.hideCurtains||"")+">&nbsp;<label title='Leaves a blank space over deleted item.'>Also hide curtains.</label>" : "")
			+"<br><input id=sfswe-checkbox type=checkbox style='vertical-align:middle; margin-left:3px;'"+(preferences.config.noAnimation||"")+">&nbsp;<label>Disable animation (in general).</label>"
			+"<br><input id=sfswe-checkbox4 type=checkbox style='vertical-align:middle; margin-left:3px;'>&nbsp;<label title='Check box then hit ok'>Set your own curtains' image.</label>"
			+"<input id=sfswe-checkbox5 type=checkbox style='vertical-align:middle;margin-left:15px;'"+(preferences.config.monitor[gobj.website]||"")+">&nbsp;"
			+"<label>Monitor this website for new elements.</label>"
			+"<br><input id=sfswe-checkbox9  type=checkbox style='vertical-align:middle; margin-left:15px;'>"+"&nbsp;<label title='Check box then hit ok'>Export/Import script's stored data.</label>"  
			+"</div>"
	);
	dialog.find("input:checkbox").css({height:12});
	dialog.find(".ui-dialog-content").attr("title","WebEraser userscript.\n"+gobj.webpage+"\n\nCurrent matches at this webpage:\n");
	dialog.find(".sfs-link").click(e => {
		dialog.trigger($.Event("keydown",{keyCode:27, key:"Escape"})); // close prompt and open Prefs dialog.
		eraseIframe();});
}	

async function exportImportScriptData()	{
	const nvs = [], array_of_keys = await GM_listValues();
	for (let n of array_of_keys) {
		nvs.push( { name:n, value_str: await GM_getValue(n) } );
	}
	sprompt("Stored data, export by copying the entire string below.  Import by pasting that entire string below.", JSON.stringify(nvs, null,"\t"))
		.then(async function([btn, reply_text]){  // pretty print json
			if(!btn) return;
			const new_nvs = JSON.parse(reply_text);
			for(let obj of new_nvs) {
				alert("setting with given name:"+obj.name+", value:"+obj.value_str);
				await GM_setValue(obj.name, obj.value_str);
			}
		});
}

function setOwnCurtains(){
	toggleCurtains();
	const subpromt = sprompt("Please enter http address of curtain image to be used.  If giving left and right images separate with a space.  "
						     +"Leave empty to reset.  Accepts base64 image strings.","");
	subpromt.dialog.attr("title","Perhaps try a quaint example; one found with an image search for 'curtains':\n\thttp://www.divadecordesign.com/wp-content/uploads/2015/09/lace-curtains-5.jpg");
	subpromt.then(function([btn2, reply2]){
		if (btn2) { setValue("ownImageAddr", reply2);
					gobj.curtain_icon = reply2||gobj.whitecurtains;
					gobj.curtain_slim_icon = reply2||gobj.whitecurtainsoriginal;
					gobj.curtain_wide_icon = reply2||gobj.whitecurtainstriple;
					$(".WebEraserCurtain").attr("src", gobj.curtain_icon);  }
		toggleCurtains(); });
} 

function savePreferences(reply_text)	{ 
	console.log("savePreferences", reply_text);
	reply_text = reply_text.replace(/\s*,\s*/g,",").replace(/(?=[^,])\n(?=[^,])/g,",").split(/,/); // , newline->comma if none; if no comma all is put in [0]
	try{ $(reply_text); } catch(e){ alert("Bad selector given."); throw(e);}
	
	if(reply_text.length) 
		fitEachSelector(reply_text);
	persistSelectors();
	effectPageUpdate();
}

function fitEachSelector(reply_text) {
	preferences.page_erasedElems = []; preferences.site_erasedElems = []; 
	buildSelectorArray(reply_text);
	preferences.site_erasedElems = preferences.site_erasedElems.toString();
	preferences.page_erasedElems = preferences.page_erasedElems.toString();
}

function buildSelectorArray(reply_text){ 
	const duplicates = {};
	$(reply_text).each((i, str) => {	
		if (str == "") return;
		if (duplicates[str]) return;
		duplicates[str] = true;
		str = str.trim();
		if (/\ssite$/.test(str)) preferences.site_erasedElems.push(str.replace(/\ssite$/,""));
		else preferences.page_erasedElems.push(str);
	});
}

function persistSelectors()	{
	setValue("config", preferences.config);
	console.log("SetValue on preferences .config to:", preferences.config);

	setValue(gobj.website+":erasedElems", preferences.site_erasedElems);
	setValue(gobj.webpage+":erasedElems", preferences.page_erasedElems);
	preferences.zaplists.update();
}

function effectPageUpdate() {
	openCurtains();
	$(".Web-Eraser-ed").each(unerase);
	$(".CurtainRod").remove();
	setTimeout(inner_eraseElements, 1000,"prompt"); //'cos openCurtains takes time
	//inner_eraseElements("fromPrompt");
}

function unerase(){
	const self = $(this);
	self.css({display: self.data("sfswe-display"), visibility: self.data("sfswe-visibility")});
	self.removeClass("Web-Eraser-ed");
};

function inner_eraseElements(from) { 
	var erasedElems = getErasedElemsCmd();
	const len = erasedElems.length, erasedElems_ar = erasedElems.split(/,/), nomatch = [];
	var count = 0;
	if (erasedElems_ar[0] == "") 
		erasedElems_ar.shift(); //fix split's creation of array length one for empty string.
	var theErased = $(".Web-Eraser-ed"); 
	theErased.removeClass("Web-Eraser-ed");
	({erasedElems, count} = doEachErasure());
	if (gobj.iframe || count == 0) 
		return;
	theErased = $(".Web-Eraser-ed");
	observeThings();
	if (len == 0)  observeThings("off");
	var ieemsg = prefMsg(count);
	printUserInfoToConsole(len, nomatch, count, from);

    //// Nested functions:
	function doEachErasure(){
		erasedElems_ar.forEach((sel, i) => {
			erasedElems = $(sel);                                   //Array.from(document.querySelectorAll(sel)); //$(sel), jQ cannot find duplicate ids.
			if (erasedElems.length == 0) { 
				let erasedElems_sp = $(stripClasses(sel)); 
				if(erasedElems_sp.length == 1) 
					erasedElems = erasedElems_sp; 
			}
			count = curtainOrUndisplayThose(sel);
			if (erasedElems.length == 0 && sel) nomatch.push(sel);
		});
		return {erasedElems, count};
	}

	function curtainOrUndisplayThose(sel) {
		erasedElems.each(function(){ 
			const eld = this, el = $(eld);                     
			if(/delay|focus/.test(from)	&& alreadyClosed(el, eld)) 
				return;
			markAndErase(el, eld, sel);
			count++;
		});
		return count;
	}

	function markAndErase(el, eld, sel) {
		markForTheCurtains(el, eld, sel);
		const no_anima = preferences.config.noAnimation, keep_layout = preferences.config.keepLayout;                                                   
		if (no_anima && !keep_layout)  
			eld.style.setProperty("display","none","important");
		else  if (el.css("display")!="none")
			closeCurtains(el, no_anima, measureForCurtains);
	}

	function alreadyClosed(el, eld)  {
		const crod = jQuery.data(eld,"rod-el");      
		if (crod && /^sfswediv/i.test(crod[0].tagName)) {
			el.addClass("Web-Eraser-ed");
			return true;
		}
	}

	function printUserInfoToConsole()	{
		if (theErased.length == 0) return;  ////////////////////
		if (nomatch.length) {
			console.info("WebEraser message: no match for the following selectors at", gobj.webpage+":");
			nomatch.forEach(nom => console.info("\t", nom));
			//console.log("Q:", document.querySelectorAll("body *"), typeof $$)
		}
		addIndivMsgs();
		ieemsg+="(phase:"+from+")";
		count = 0;
		console.info(ieemsg);
	}
	
	function prefMsg(){
		return "Userscript WebEraser has selectors to erase.  "+count+(count == 1 ? " element that was":" elements that were")+" present on page at site: "+gobj.website
			+".\nSee GM menu command Erase Web Elements to check and edit selector list.  "
			+(preferences.config.keepLayout ? "" : "Keep layout is not ticked.")
			+(preferences.config.noAnimation ? "Animation is off." : "")
			+(preferences.config.hideCurtains ? "Hide curtains is ticked." : "");
	}

	function addIndivMsgs() {
		theErased.each(function(i){
			const that = $(this), sel = that.attr("selector-this-matched-we");
			const onzaplist = preferences.zaplists.which(sel), rod = jQuery.data(this,"rod-el");
			const is_an_overlay = (rod && rod.hasClass("sfswe-overlay"));                       //that.prev().hasClass("sfswe-overlay");
			ieemsg+="\n"+(i+1)+":"+sel;
			ieemsg+=".\t\t"
				+(is_an_overlay ? "=> Considered as an Overlay, takes up > 90% (was 0.6) of window, deleted."
				  : onzaplist.zap ? " => complete erasure."
				  : onzaplist.keep_layout ? " => erase but keep layout."
				  : "" );
		});
		return ieemsg;
	}
} // end inner_eraseElements().

function closeCurtains(elem, noAnimKeepLayout, finishedCB = x => x) {   // a bracketing function to avoid class 'this' pollution.
	const [curtainRod, lrcurtains] = getCurtainParts(getPrevCurtains());
	const onzaplist = preferences.zaplists.which(elem), 
		  hide_curtains = preferences.config.hideCurtains;
	if (noAnimKeepLayout) 
		eraseWithoutFuss();
	else animateClose(finishedCB);
	return false; // if run from event handler prevents default.
	

	function getCurtainParts(old_curtained){
		let curtainRod, lrcurtains;
		if ( ! old_curtained || ! old_curtained.is(elem))
			[curtainRod, lrcurtains] = makeCurtains(elem, noAnimKeepLayout);
		else { 
			curtainRod = elem.siblings("sfswediv");
			lrcurtains = curtainRod.children();
		}
		curtainRod.css("display","");
		return [curtainRod, lrcurtains];
	}

	function getPrevCurtains(){	
		const	wediv = elem.siblings("sfswediv");
		return wediv.length ? jQuery.data(wediv[0],"covered-el") : null;
	}
	
	function eraseWithoutFuss() {
		lrcurtains.css({width:"51%"});
		if (onzaplist.zap) { curtainRod.css({display:"none"}); elem[0].style.setProperty("display","none","important");} // "none" triggers monitor if on.
		else if (onzaplist.keep_layout||hide_curtains||curtainRod.hasClass("sfswe-overlay")){
			curtainRod.css({visibility:"hidden", display:""});
			elem[0].style.setProperty("visibility","hidden","important");
		}
		measureForCurtains();
	}

	function animateClose() {
		// Do animated curtain closing, then, perhaps, fade out.
		const that = animateClose; if (!that.final_curtain) that.final_curtain = 0;
		const keep_layout = preferences.config.keepLayout;
		that.final_curtain++;
		profileTimer("start-animation");
		manimate(lrcurtains,["width", 15,"%"], 1000, 2);
		manimate(lrcurtains,["width", 51,"%", 1000], 1000, 5,
				 function() { endManimate.call(this, keep_layout, that);});
	}
	
	function endManimate(keep_layout, that) { 
		profileTimer("end-animation");  // this from eppurSiMuove is the right curtain obj.
		lrcurtains.css("width","51%");
		curtainRod.css("visibility","visible");
		const el = jQuery.data(this.parentNode, "covered-el")||$();
		if (!keep_layout || curtainRod.hasClass("sfswe-overlay")||onzaplist.zap) 
			fadeOut(el, curtainRod, that, finishedCB);
		else if (hide_curtains||onzaplist.keep_layout) 
			fadeFully(el, curtainRod, that, finishedCB);
		else if (--that.final_curtain == 0) 
			finishedCB(curtainRod);
	}

	function fadeOut(el, that) {
		el.add(curtainRod).delay(200).fadeOut(500, function(){
			this.style.setProperty("display","none","important"); // triggers monitor if on.
			if (el[0] == this && --that.final_curtain == 0) 
				finishedCB();
		});
	}
	
	function fadeFully(el, that){
		el.add(curtainRod).delay(200).fadeOut(
			1000, function(){
				this.style.setProperty("visibility","hidden","important");
				this.style.setProperty("display", $(this).data("sfswe-display"),"important"); //triggers monitor.
				curtainRod.css({visibility:"hidden", display:""});
				curtainRod.remove();
				let itsOnLastCurtain = (el[0] == this && --that.final_curtain == 0);
				if (itsOnLastCurtain) finishedCB();
			});
	}
} // end closeCurtains().

function keypressHandler(event) { //try {  //while prompt is open.
	switch(event.key) {
	case "w": widen(); break;
	case "n": narrow(); break; 
	default: return; } 
	return false;
}

async function init_async_globs() { // all globs asynchronously set.
	profileTimer("init phase2-start");
	preferences.zaplists = new ZaplistComposite(); 
	await preferences.zaplists.update(); //depends on site/page_erasedElems being read first.

	gobj.ownImageAddr = await getValue("ownImageAddr","");
	await initCurtainGlobs();                	// This instruction when in TM using GM_ version, is very slow, it returns a base64 string, 2, 928, 417 bytes in length.  Slow on chromium/TM, ok on FF.

	profileTimer("init phase2-end");
}

async function initCurtainGlobs() {
	gobj.whitecurtains = await getResourceUrl("whiteCurtains");
	gobj.whitecurtainsoriginal = await getResourceUrl("whiteCurtainsOrig");
	gobj.whitecurtainstriple = await getResourceUrl("whiteCurtainsTrpl");
	gobj.whitecurtainsxsm = await getResourceUrl("whiteCurtainsXsm");

	gobj.curtain_icon = gobj.ownImageAddr|| gobj.whitecurtains;
	gobj.curtain_slim_icon = await getValue("ownImageAddr","")||gobj.whitecurtainsoriginal;
	gobj.curtain_xslim_icon = await getValue("ownImageAddr","")||gobj.whitecurtainsxsm;

	gobj.curtain_wide_icon = await getValue("ownImageAddr","")||gobj.whitecurtainstriple;
}

function installEventHandlers(phase2) {
	if(!phase2) evhandlersPhase1();
	else evhandlersPhase2();
}

function evhandlersPhase1() {
	
	document.addEventListener("scroll", function(e){ if (!gobj.overlay) return; e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}, true);
	
	window.addEventListener("click", handleClick, true);
	window.addEventListener("mousedown", handleClick, true);
	window.addEventListener("message", postMessageHandler, false);
	if(gobj.iframe) window.installedEHs = true;
	//console.log("installed handlers, window.mousedown, at:", location.href,".  In iframe?", iframe);
}

function evhandlersPhase2() { // phase2
	$("iframe").each(function(){
		const fwin = this.contentWindow; try{ //perhaps permission error due to iframe origin.
			if (!fwin.installedEHs) {
				fwin.addEventListener.call(fwin,"mousedown", handleClick, true);
				fwin.addEventListener.call(fwin,"message", postMessageHandler, false);
				//despite use of call(), event is still triggered in this context not in iframe's hence use of frameElement.
			}} catch(e){};
	});
}

function prevDef(e) { 
	if (e.preventDefault) {
		e.preventDefault();   e.stopPropagation(); e.stopImmediatePropagation();  }
}

function postMessageHandler(e){ // window.postMessage comms
	const itsaMsgForWebEraser = ( e.data?.type == "sfswe-iframe-click");
	if (itsaMsgForWebEraser) {
		if (gobj.iframe) {
			window.parent.postMessage({type:"sfswe-iframe-click", code:++e.data.code},"*");
			return;
		}
		const iframeEl = findIframe(e); 	                                               //$("iframe, embed").each((i, el)=>{ !! removed, no jQ in iframe.
		handleClick({target:iframeEl},"click_from_nested_iframe");
	}
}

function findIframe(e){
	for (let el of document.querySelectorAll("iframe, embed")) {
		if (el.contentWindow == e.source ||e.data.src == el.src) { 
			return el;
		} 
	}
}

function getSelectorWithNearestId(target, exclude_classes) { // need extended jquery for :regexp 
	ensure_jquery_extended(); 
	const nearestNonNumericId = target.closest(":regexp(id,^\\D+$)").attr("id");
	var sel, nnnid = nearestNonNumericId;                      //closest also checks target
	if (nnnid && $("[id = "+nnnid+"]").length>1) {
		nnnid = "";
		gobj.ignoreIdsDupped = true;
	} // Page error duplicate ids, ignore id.
	return getFullSelector(nnnid, sel, target, exclude_classes);
}

function getFullSelector(nnnid, sel, target, exclude_classes){
	if (nnnid) 
		nnnid = $("#"+nnnid).prop("tagName")+"#"+nnnid; //cos of jQ & multiple ids.
	if ($(nnnid).is(target)) 
		sel = nnnid;
	else {
		sel = selector(target, $(nnnid), true, 0, exclude_classes); //ok if nnnid is undefined id.
		if (!sel) 
			sel = nnnid; //both target and $(nnnid) are same element. 
		else if(nnnid && !/^html/i.test(nnnid)) 
			sel = nnnid+sel; 
	}
	return sel;
}

function getErasedElemsCmd(cmd, el){
	const els = preferences.page_erasedElems, pels = preferences.page_erasedElems;
	var sels = preferences.site_erasedElems;
	switch(cmd) {
	case "match el":  return el.is($(getErasedElemsCmd()));
	case "isPage":    return el.is($(pels));
	case "count":     return getErasedElemsCmd().split(/,/).reduce(function(prev_res, sel){return prev_res+$(sel).length;}, 0);
	case "with site": sels = sels.replace(/,/g," site,")+(sels ? " site" : ""); // see reverse of this in erasedElementsListCmd() and  erasurePreferences().
	default:          return pels + (sels && pels ? "," : "") + sels;	// if (justpels_ar) return pels.split(","); //webpage elements.
	}
}

function erasedElementsListCmd(cmd, str, str2) {
	//console.log("erasedElementsListCmd, cmd:", cmd, "str:", str,"str2:", str2, "ErasedElems:", getErasedElemsCmd());
	var  sitewide, retval;
	var cmdObject = { "isthere?": isStrThere, add: addErasureSel, mv: moveSelToNewOne, rm: removeSelectorFromErasedElemsList };
	return cmdObject[cmd](str, str2);
}

function addErasureSel(str){		
	if (!erasedElementsListCmd("isthere?", str)) {
		var sitewide;
		checkSite();
		appendRightStr();
		storeChanges();
	}

	function checkSite(){
		if (/\ssite$/.test(str)) { 
			sitewide = true; 
			str = str.replace(/\s+site$/,"");  
		}
	}
	function appendRightStr() {
		if (sitewide)  
			preferences.site_erasedElems += preferences.site_erasedElems ? ","+str : str;
		else  
			preferences.page_erasedElems += preferences.page_erasedElems ? ","+str : str;
		$(str).each(function() {  
			$(this).data("sfswe-oldval", $(this).css(["display","visibility","height","width"]));	
		});
	}
	
}


function isStrThere(str) {
	return getErasedElemsCmd().split(/,/).includes(str);
}

function moveSelToNewOne(str, str2) {
	erasedElementsListCmd("rm", str);
	erasedElementsListCmd("add", str2);
}

function removeSelectorFromErasedElemsList(str){		
	if (str instanceof $) { 
		str.each(function(){ 
			erasedElementsListCmd("rm", $(this).attr("#selector-this-matched-we"));	
		});  
		return str.length; 
	}
	cutOutOfTheString(str);
	storeChanges();
}

function cutOutOfTheString(str){	
	preferences.page_erasedElems = $.map(
		preferences.page_erasedElems.split(/,/),
		el => el == str ? null : el.trim()).join(",");
	preferences.site_erasedElems = $.map(
		preferences.site_erasedElems.split(/,/),
		el => el == str ? null : el.trim()).join(",");
}

function storeChanges(){	
	setValue(gobj.website+":erasedElems", preferences.site_erasedElems);
	setValue(gobj.webpage+":erasedElems", preferences.page_erasedElems);
	preferences.zaplists.update();
}

//Blinks are double, one for selected elements, other is only when at top/bottom of narrow/widen chosen.
function hlightAndsetsel(elem, off, restore, mere_highlight) {try{ //also updates prompt with elem's selector.
	if (!off) 
		turnHighlightOn(elem);
	else 
		turnHighlightOff(restore);

}catch(e) {console.error("hlightAndsetsel(), error:", e.lineNumber, e);}}

function turnHighlightOn(elem){		
	elem = $(elem);
	if (elem.length == 0) return;
	gobj.trace_elem = $(elem);
	const height = gobj.trace_elem.height(),
		  width = gobj.trace_elem.width();
	updatePrompt();
	blinkRedBorder(height, width);
}

function blinkRedBorder(height, width){
	setTraceBack(height, width);
	gobj.bblinker = setInterval(function(){ // normal "selected" blink.
		if (gobj.sel_matching_els.length) 
			gobj.sel_matching_els.toggleClass(gobj.rbcl);
		else gobj.trace_elem.toggleClass(gobj.rbcl);   
	}, 1200);
}

function setTraceBack(height, width) {	
	gobj.trace_elem.data("pewiden-trace","true"); 
	gobj.sel_matching_els.addClass(gobj.rbcl);
	gobj.trace_elem.elh = gobj.trace_elem[0].style.height;	
	gobj.trace_elem.elw = gobj.trace_elem[0].style.width;
	gobj.trace_elem.height(height- 2*gobj.border_width);
	gobj.trace_elem.width(width- 2*gobj.border_width);
}

function turnHighlightOff(restore){
	clearInterval(gobj.bblinker);
	gobj.sel_matching_els.removeClass(gobj.rbcl);
	gobj.trace_elem[0].style.height = gobj.trace_elem.elh;	
	gobj.trace_elem[0].style.width = gobj.trace_elem.elw;
	if (restore) $("."+gobj.tbcl).removeClass(gobj.tbcl); 
}

function updatePrompt() {  //endif !mere_highlight
	const selinput = $("#sfswe-seledip"),           
		  elhtml = gobj.trace_elem[0].outerHTML.replace(gobj.trace_elem[0].innerHTML,"");
	let exclude_classes = gobj.tbcl+" "+gobj.rbcl+" Web-Eraser-ed";
	const newsel = getSelectorWithNearestId(gobj.trace_elem, exclude_classes);
	const fullsel = selector(gobj.trace_elem, 0, false, 0, exclude_classes);
	gobj.sel_matching_els = $(newsel); 
	setPromptInput(selinput, newsel, fullsel, elhtml);
}

function setPromptInput(selinput, newsel, fullsel, elhtml) {
	selinput.val(newsel); 
	selinput.prop("title", (newsel!=fullsel ? "Full selector:\n\n\t"+fullsel+"\n\n" : "")
				  +"Element html:\n"+elhtml
				  +"\n\nElement style:\n"+myGetComputedStyle(gobj.trace_elem[0]));
	updatePromptText(newsel, fullsel,"hide");
	console.info("WebEraser info: "+gobj.sel_matching_els.length+" element(s) highlighted has selector:\n\t\t", newsel);
	console.groupCollapsed(gobj.sel_matching_els.length);console.log(gobj.sel_matching_els.toArray()); console.groupEnd();
}

function widen() { // .html() return &gt; encodings, .text() does not.  tab as @emsp must be set with html() not text()
	const selinput = $("#sfswe-seledip");
	selinput.parent().show();

	const sel = selinput.val(); 
	if (/[:.][^>]+$/.test(sel)) { // special case of widen, not just jump to parent. Regexp matches end of sel as eg, ":nth-of-type(2)"
		widenFromNthOfType(selinput);
		return;                // No call to hlightAndsetsel, hence no trace of nth-of-type etc. left, a subsequent narrow will jump back.
	}
	blinkOrHighlight();
}

function blinkOrHighlight(){
	const p = gobj.trace_elem.parent();
	if (p.is("body")) {
		doubleBlinkBorders($("body")); //blink double indicates top of hierarchy.
		return;
	}
	hlightAndsetsel(0,"off");
	hlightAndsetsel(p);
}

function widenFromNthOfType(selinput){
	const newsel = selinput.val().trim().replace(/[:.][^:.]+$/,"");  // Remove eg, ":nth-of-type(n)", matches now multiple elements.
	selinput.val(newsel);
	gobj.sel_matching_els = $(newsel);
	gobj.sel_matching_els.addClass(gobj.rbcl);
	updatePromptText();   
}

function narrow() {
	const selinput = $("#sfswe-seledip");
	selinput.parent().show();  // show extra detail in user prompt, selector update.
	var trace = gobj.trace_elem.find(":data(pewiden-trace):first"); // trace left by hlightAndsetsel()
	if(trace.length == 0) trace = gobj.trace_elem.find(">:only-child");
	if (trace.length == 0) {
		doubleBlinkBorders(gobj.trace_elem);
		return;
	}
	hlightAndsetsel(0,"off");
	hlightAndsetsel(trace);
}


function doubleBlinkBorders(elem, interval = 150, times = 4) { // borders must already be set.
	times*=2;
	var cnt = 0, i= setInterval(function(){
		cnt++;
		elem.toggleClass(gobj.rbcl);
		if (cnt == times) {clearInterval(i);elem.removeClass(gobj.rbcl);}// interference so rm class.
	}, interval);
}

function updatePromptText(newsel, fullsel) { 	// set text size tagname etc.
	var updated_text = "";
	if (gobj.sel_matching_els.length<=1)
		updated_text = "selected ("+gobj.trace_elem.prop("tagName").toLowerCase()+") element ("+(gobj.trace_elem.height()|0)+"x"+(gobj.trace_elem.width()|0)+"pixels)";
	else
		updated_text = "selected "+gobj.sel_matching_els.length+" "+gobj.trace_elem.prop("tagName").toLowerCase()+"s";
	updated_text+=":";
	setTitle(newsel, fullsel);
	$("#fsfpe-tagel").text(updated_text);
}

function setTitle(newsel, fullsel){
	var extra_msg = $("#fsfpe-tagel").parent();
	extra_msg.prop("title","Click here to invoke widen/narrow with 'w' and 'n' keys resp."
				   +"\nClick on the internal code below, then move mouse a small bit to see "
				   +(newsel!=fullsel ? "full position in hierarchy," : "")
				   +" html and style preferences of the selected element. ");
}

function myGetComputedStyle(el) {
	if (!document.defaultView.getDefaultComputedStyle) return ""; // has no getDefaultComputedStyle().
	var roll = "", defaultStyle = document.defaultView.getDefaultComputedStyle(el);
	var y = document.defaultView.getComputedStyle(el), val, val2, i = 1;
	for (let prop in y) {
		if (/^[a-z]/.test(prop) && ! /[A-Z]/.test(prop) && (val = y[prop]) && val!=defaultStyle[prop]) {
			if (val.trim)  //just a type check
				if (val.startsWith("rgb")) val = "#"+val.replace(/[^\d,]/g,"").split(/,/).map(x => Number(x).toString(16)).join("");
			if (prop.startsWith("border") && y[prop.replace(/-\w*$/,"")+"-style"] == "none") continue; // Error in getDefaultComputedStyle borders not set properly (eg, color should be that of el)
			roll+= prop +": "+val+"; ";
			if (i++%3 == 0) roll+="\n";
		} //endif
	}
	return roll;
}

function ensure_jquery_extended() { 
	if ($.expr[":"].regexp && $.fn.reverse) 
		return; 
	$.extend($.expr[':'], {                      
		regexp: jQregexpColonSelector  // usage example: $(“div:regexp(className, promo$)”);
	}); 
	$.fn.reverse = Array.prototype.reverse; 
}

function jQregexpColonSelector(currentobj, i, params, d) {   //filter type function.
	params = params[3].split(/,/);                             //eg, [ 'regexp', 'regexp', '', 'className, promo$' ]
	var attr = params[0], re = params[1];                        //eg, className, promo$
	if (attr == "class") attr = "className";
	var val = currentobj[attr]+""||"";
	if (attr == "className") return val.split(/\s/).some(function(clss){return clss.match(re);});
	else return val.match(re);
}

function selector(desc, anc, no_numerals, recursed, exclude_classes) {try{ // descendent, ancestor, such that ancestor.find(ret.val) would return descendant.  If no ancestor given it gives it relative to body's parent node.   // See example usage in checkIfPermanentRemoval(). Numeraled classes/ids are excluded.
	anc = $(anc).eq(0); //apply only to first ancestor.
	if (anc.length == 0) anc = $(document.body.parentNode); // !anc wouldnt work for a jq obj.
	desc = $(desc);
	if ( (desc.closest(anc).length == 0 || desc.length!=1) && !recursed) {
		console.info("Too many elements or descendant may not related to ancestor:");
		console.info("Descendant is:"+selector(desc, 0, 0, true));
		console.info("Ancestor is:"+selector(anc, 0, 0, true)+".");
		return;
	}
	// Last element is highest in node tree for .parentsUntil();
	var sel = buildSelectorString(desc, anc, exclude_classes, no_numerals);
	return sel;

} catch(e){console.log("Can't get selector for ", e,"Element:", desc[0]); }}  //fixBadCharsInClass(desc);}

function buildSelectorString(desc, anc, exclude_classes, no_numerals)	{	
	var sel = desc.add(desc.parentsUntil(anc))                   
		    .reverse().map(function() { 
			    return buildSelNameArray.call(this, exclude_classes, no_numerals); 
		    }).get().reverse().join(">");          
	sel = fixTopSel(sel, desc, anc);
	return sel;
}

function buildSelNameArray(exclude_classes, no_numerals) {                                
	var t = $(this), tag = this.tagName.toLowerCase(), nth = t.prevAll(tag).length+1, id = "", cl, nthcl;			//id=this.id.replace(/^\s*\b\s*/,"#"); if (!gobj.ignoreIdsDupped) id="";
	cl = (t.attr("class")||"").trim();            // Don't use this.className (animated string issue)
	cl = cl.split(/\s+/).join(".").prefix("."); 
	if (exclude_classes) cl = cl.replace(RegExp(".("+exclude_classes.replace(/ /g,"|")+")","g"),"");
	if (no_numerals && /\d/.test(id)) id = "";
	if (no_numerals && /\d/.test(cl)) cl = "";
	if ( (cl && t.siblings(tag+cl).length == 0)
		 || id
		 || t.siblings(tag).length == 0)
		nth = 0;
	else if (cl && t.siblings(tag+cl).length!=0) {
		cl+=":eq("+t.prevAll(tag+cl).length+")";   //jQuery only has :eq()
		nth = 0;
	}
	return tag+(nth?":nth-of-type("+nth+")":"")+id+cl; ////////////////////nth-of-type is One-indexed.
}

function fixTopSel(sel, desc, anc){
	if (desc.is(anc.find(">"+sel))) {
		if (anc.is(document.body.parentNode)) sel = "html>" + sel;
		else sel = ">"+sel;
	} else {
		console.info("Selector:"+sel+", for element:", desc[0],"is not findable in ancestor", anc[0],", nor in body's parent.");
		if ($(sel).length == 0) sel = undefined;             // Its the very top element, <HTML>.
	}
	return sel;
}

function stripClasses(s) {
	var stripped = s.replace(/\.[^.>\s]+/g,"");
	//console.log("Forced to strip classes for:", s,"Stripped:", stripped,"matched:", $(stripped).length);
	return stripped;
}


function fixBadCharsInClass(obj) { //official chars allowed in class, throw error in jquery selection.
	obj.parents().addBack().each(function(){ this.className = this.className.replace(/[^\s_a-zA-Z0-9-]/g,""); });
}

function markForTheCurtains(el, eld, sel, unmark) {
	if (!unmark) {
		el.css({overflow:"hidden"}).addClass("Web-Eraser-ed").attr("selector-this-matched-we", sel) //hidden, so height not 0.
			.data({sfsweDisplay: eld.style.display, sfsweVisibility:eld.style.visibility, sfsweOverflow: eld.style.overflow}); // needed in case zero height element with floating contents. // To make it have dims, in case of zero height with sized contents.
	}
	else el.css({overflow:el.data("overflow")}).removeClass("Web-Eraser-ed").attr("selector-this-matched-we",""); //hidden, so height not 0.
}

function reattachTornCurtains(curtains = $(".CurtainRod")) {try{
	var torn = false;
	curtains.each(function(){
		var that = $(this), el = jQuery.data(this,"covered-el")||$();
		if (el.parent().length == 0 || !el.hasClass("Web-Eraser-ed")) {
			torn = true;
			that.addClass("sfswe-delete","true");
			//that.remove();
		}    });
	$(".sfswe-delete").remove();
	if (torn) inner_eraseElements("torn");
} catch(e){console.error("WebEraser reattachTornCurtains(), error@", e.lineNumber, e);}}

function measureForCurtains(curtains = $(".CurtainRod")) {
	curtains.each(function(){
		var that = $(this), el = jQuery.data(this,"covered-el");          // $.data seems to lose its info when another userscript is also running, jQuery.data works.
		if(!el) throw "Demi-err, no-element in measureForCurtains";   //{console.error("Demi-err, no-element in measureForCurtains");el=$();return;}

		var w = el.outerWidth(), h = el.outerHeight()+1;                  // Includes padding & border, margin included if 'true' passed.  jQuery sets and unsets margin-left during this, provoking attrModifiedListener.
		if (!el.hasClass("Web-Eraser-ed")) {
			el.addClass("Web-Eraser-ed");
			el.css({overflow:"hidden"});
		}
		setCurtainStyle.call(this, that, el, h, w);
	});
};

function setCurtainStyle(that, el, h, w){
	if(!that.hasClass("outie")) {
		that.css({left:0, top:0});
		this.style.setProperty("width","100%","important");
		this.style.setProperty("height","100%","important");
	}else {
		var offset = moffset(el);
		that.css(offset).css({height:h, width:w});
		this.style.setProperty("width", w+"px","important");
    }}

function observeThings(disable) { // call will start or if running reset monitoring, with param, it disables.
	var that = arguments.callee; that.off = [];
	if (that.obs1) { try { that.obs1.disconnect(); that.obs2.disconnect();} catch(e){
		console.log("Error during turn off of observations,", e);  } }
	if (disable || ! preferences.config.monitor[gobj.website]) return;

	var a, b, sels = getErasedElemsCmd(),
		nomonitor = set => { 
			if (set == 1) {
				that.off.push(true); a = that.obs1.takeRecords(); b = that.obs2.takeRecords(); }
			if (set == 0) { 
				that.off.pop(); a = that.obs1.takeRecords(); b = that.obs2.takeRecords();}
			return that.off.slice(-1)[0]; // if neither returns undefined.
		};
	console.info("WebEraser message: Monitoring elements that match given selectors for creation and display and to be erased on sight.");
	$(sels).each((i, el) => $(el).data("sfswe-oldval", $(el).css(["display","visibility","height","width"])) ); //copy of style obj but dead (eg, cssText not updated).
	obs1_connect(sels, that, nomonitor);
	that.obs2 = addMutationListener(nomonitor, sels);
}

function obs1_connect(selectors, that, nomonitor) {
	that.obs1 = attrModifiedListener(document, selectors,["style","class","id"], function(mutrecs) {
		if (nomonitor()) return;
		nomonitor(1);
		var rec = mutrecs[0], t = rec.target, target = $(t), attr = rec.attributeName;
		var oldval = target.data("sfswe-oldval"), currval = target.css(["display","visibility","height","width"]);
		var objsel = target.attr("selector-this-matched-we");
		oldval = checkOldVal(objsel, target, t, selectors, oldval, that, attr);
		checkIfNewnodeIsForTheCurtains(currval, oldval, target);
		nomonitor(0);
	}); 
}

function checkOldVal(objsel, target, t, selectors, oldval, that, attr){
	if (!objsel) {
		target.data("sfswe-oldval", target.css(["display","visibility","height","width"]));
		markForTheCurtains(target, t, findMatchingSelector(target, selectors));
	}
	if (!oldval && /class|id/.test(attr)) { //&& target.prev("sfswediv")[0]) {
		var newlen = that.obs1.add(target);
		oldval = {};
	}
	return oldval; 
}

function checkIfNewnodeIsForTheCurtains(currval, oldval, target)	{
	if (currval.display == "none" && oldval.display!="none") {
		target.siblings("sfswediv").css("display","none");
		measureForCurtains();
	} else if (currval.display!="none" && (oldval.display == "none" || oldval.display == undefined )) {
		target.siblings("sfswediv").css("display","");
		closeCurtains(target); //, true); //no animation since asynch anime will trigger too many mutation records.
	}
	if ( parseInt(currval.height)|0 - parseInt(oldval.height)|0) {
		measureForCurtains();
	} else if ( parseInt(currval.width)|0 - parseInt(oldval.width)|0) {
		measureForCurtains();
	} else if (currval.visibility!=oldval.visibility)
		target.data("sfswe-oldval", currval);
}

function addMutationListener(nomonitor, sels) {		
	return nodeMutationListener(document, sels, function(foundArrayOfNodes, parentOfMutation, removed) {
		if (nomonitor()) return;
		nomonitor(1);
		foundArrayOfNodes.forEach(function(node){ checkTheNode(node, removed, sels);  } );
		nomonitor(0);
	}, true);
}

function checkTheNode(node, removed, sels){   // A flattened subtree, if node was again removed quickly it may have no parent.
	var jQnode = $(node);
	if (!removed) { // new node inserted.
		jQnode.data("sfswe-oldval", jQnode.css(["display","visibility","height","width"]));
		var foundsel = findMatchingSelector(jQnode, sels);
		markForTheCurtains(jQnode, node, foundsel);
		closeCurtains(jQnode, false, measureForCurtains); //nomonitor(0); }, 300);
	} else { // node removed
		$(".CurtainRod[cc = '"+jQnode.attr("cc")+"']").remove(); //.filter(function(){return $(this).data()})
		measureForCurtains();
	}
}

function findMatchingSelector(obj, sels) {
	return sels.split(/,/).find(sel => obj.is(sel));
}

function openCurtains(zap_or_keep = "", curtains = $(".WebEraserCurtain")) {                 // called from ctrl-click with curtains, erasurePreferences() w/o curtains, and lrcurtains.click sets "keep"
	setTimeout(function() {
		curtains.each(function() {
            $(this).parent().css("visibility","hidden");
        });
		manimate(curtains,["width", 0,"%"], 3500, 8, function() {
			var that = $(this), erased_el = jQuery.data(this.parentNode,"covered-el"); 
			var sel = erased_el.attr("selector-this-matched-we");
			switch(zap_or_keep[0]) { // z: zap from layout, k: keep layout, t temporarily rm curtains, a: alt rm erasure
			case "z":
                preferences.zaplists.add(sel);
                erased_el.css("display","none");
                measureForCurtains();console.info("Completely erased,", sel+".");
                break; 
			case "k":
                preferences.zaplists.add(sel,"keep");
                erased_el[0].style.setProperty("visibility","hidden","important");
                console.info("Hidden for layout,", sel+".");
                break;      
			case "t": that.parent().css("display","none");
                break;           //tzap
			case "a":
                erasedElementsListCmd("rm", sel);
                observeThings();
                that.parent().remove();
                markForTheCurtains(erased_el, 0, 0,"unmark");
                break; //azap
			}
			//erased_el.prev().css({display:"none"});
		});
	}, 1000);  // end setTimeout()
	return false;
}

//
// Outline overview of layout design:
//
//    <sfswediv tabindex="0" class="CurtainRod outie" cc=1 jQ.data("covered-el")>
//       <img class="WebEraserCurtain sfswe-left">
//       <img class="WebEraserCurtain sfswe-right">
//    </sfswediv>
//    <XYZ id=ApageEl class=Web-Eraser-ed selector-this-matched-we="XYZ#xyz" jQ.data(curtainRod)> // target el, for covering.  
//
//
// 
// Outline of stored data in script handler:
// key                        value
// ‾‾‾                        ‾‾‾‾‾ 
// <website>:erasedElems      The list of website and paths to erased elements [array of strings]
// <webpage>:erasedElems      Ditto for webpages [array of strings]
// config                     The script's preferences/configurgation values [object]
// ownImageAddr               url of custom cutain image [string]
// <website>:zaplist          These 4 values each hold a list of those elements that are to be completely removed and/or those that keep layout (kl)
// <webpage>:zaplist
// <website>:zaplist:kl
// <webpage>:zaplist:kl


function makeCurtains(el, noAnimKeepLayout) {
	var h = el.outerHeight()|0, w= el.outerWidth()|0, iw = w/2, //pos= moffset(el),    
		csspos = el.css("position");
	var [lsrc, rsrc] = chooseCurtainForWidth(w);
	var [lcurtain, rcurtain, curtainRod, lrcurtains] = setCurtainHTML(lsrc, rsrc);
	
	addToRod(el, curtainRod, lcurtain, rcurtain);
	curtainsListeners(lrcurtains, curtainRod, el);
	styleCurtains(curtainRod, lrcurtains, noAnimKeepLayout, el, w);
	checkForOverlay(lcurtain, lrcurtains, curtainRod, h, w);
	assertZ(el);      
	insertRodtoDOM(curtainRod, el, h, w);
	return [curtainRod, lrcurtains];
}

function chooseCurtainForWidth(w){
	var lsrc = gobj.curtain_icon.split(/\s+/)[0], rsrc = gobj.curtain_icon.split(/\s+/).slice(-1); //last string
	if(!gobj.ownImageAddr) switch(true) {
	case w<250:  lsrc = rsrc = gobj.curtain_xslim_icon;break;
	case w<500:  lsrc = rsrc = gobj.curtain_slim_icon;break;
	case w>800: lsrc = rsrc = gobj.curtain_wide_icon;break; }
	return [lsrc, rsrc];
}

function setCurtainHTML(lsrc, rsrc){
	var lcurtain = $("<img class='WebEraserCurtain sfswe-left' style='left:0;position:absolute;height:100%;visibility:visible;'>");
	lcurtain.attr("src", lsrc);
	var randkey = Math.random().toString(36).substring(7);
	var rcurtain = $("<img class='WebEraserCurtain sfswe-right' style='right:0;position:absolute;"
				     +"height:100%;visibility:visible;' src="+rsrc+"></img>"), 
		curtainRod = $("<sfswediv tabindex=0 rkey="+randkey+" class=CurtainRod cc="
					   +(++gobj.curtain_cnt)+" style='z-index:2147483640; position:absolute; "
					   +"display:block; opacity:0.97;visibility:hidden'></sfswediv>"),
		lrcurtains = lcurtain.add(rcurtain);
	//Absolute is relative to nearest non-statically positioned ancestor, this is returned from elem.offsetParent.
	return [lcurtain, rcurtain, curtainRod, lrcurtains];
}

function addToRod(el, curtainRod, lcurtain, rcurtain){
	var sel = el.attr("selector-this-matched-we");
	el.attr("cc", gobj.curtain_cnt);
	curtainRod.append(lcurtain, rcurtain);
	curtainRod[0].title = "Right-Click to open Preferences.\nShift-Click to hide and preserve page layout.\nCtrl-click to persistently delete from layout.\nAlt-Click to remove erasure.\nDouble click to open or close curtains.\nClick to focus and enable typing of 'w', for widen, 'n', for narrow, 'l', lighten."
		+"\n\nSelector is: "+sel+
		(getErasedElemsCmd("isPage", el) ? ", webpage is: "+gobj.webpage : ", website is: "+gobj.website)+".";
}

function curtainsListeners(lrcurtains, curtainRod, el){
	lrcurtains.contextmenu(e => (erasurePreferences(), false));
	lrcurtains.click(function({ctrlKey:ctrl, shiftKey:shift, altKey:alt, target:target}) {
		var that = $(this), lrcurtains = that.add(that.siblings());
		if (!(alt||shift)) 
			return;
		if (ctrl&&shift) alert("Curtained target is,"+target,"lrcurtains:", lrcurtains,"this", this);
		else if (shift) openCurtains("keep_layout", lrcurtains);
		else if (alt) openCurtains("azap", lrcurtains);
		else if (ctrl&&alt) that.parent().focus();
		return false;
	});
	lrcurtains.dblclick(e => openCurtains("tzap", lrcurtains));
	curtainRod.dblclick(e => openCurtains("tzap", lrcurtains));
	el.dblclick(e => closeCurtains(el)); el.mousedown(e => false);  el.mouseup(e => false);  el.click(e => false);
	curtainRod.keypress(moveRod);
}

function styleCurtains(curtainRod, lrcurtains, noAnimKeepLayout, el, w){
	curtainRod[0].style.setProperty("float","none","important");
	curtainRod[0].style.setProperty("width", w+"px","important");
	jQuery.data(curtainRod[0],"covered-el", el);
	jQuery.data(el[0],"rod-el", curtainRod);
	lrcurtains.css({ width: (!noAnimKeepLayout ? 0 : "51%" )}); // Initial width of each curtain.
}

function checkForOverlay(lcurtain, lrcurtains, curtainRod, h, w){
	var warea = window.innerHeight*window.innerWidth, area = h*w;
	var portions = area/warea*100|0;   
	if (portions>=60) { //>75% of window is covered.
		var visible_area = Math.min(w, window.innerWidth)*Math.min(h, window.innerHeight);
		if (visible_area>=warea*0.9) { // 0.6
			lcurtain.css({left:"10%"});
			curtainRod.css({width:"80%", top:"10%"}).addClass("sfswe-overlay");
			lrcurtains.css({height:h*0.8});
			setTimeout(x => $("html, body").css("overflow",(i, v)  =>  
				                                v == "hidden" ? "auto": null).css("position",(i, v) => v == "fixed" ? "static": null), 4000);
			gobj.overlay = true;
			//First event listener can stop prop to ones added later, ideally would be added at doc-start.
			console.info("This element, chosen for erasure, is an Overlay (>2/3 covered, "+portions+"%, "+h+"x"+w+"): ");
		}
	}
}
function insertRodtoDOM(curtainRod, el, h, w){	
	curtainRod.addClass("outie"); // ROD is <sfswediv> 
	let pos = moffset(el);
	curtainRod.css({height:h, width:w}).css(pos); //	curtainRod.css({height:"100%", width:"100%", left:0, top:0});
	el.before(curtainRod); 
}
function moveRod(e) {
	if (e.key == "w"||e.key == "n") {
		let  newel, rod = $(this), el = jQuery.data(this,"covered-el")||$(), newsel, oldsel = el.attr("selector-this-matched-we"), r;
		newel = findNewEl();
		if(newel === false) return;
		putRodInNewElement(newsel, el, oldsel, newel, rod);
	} else if (e.key == "l") { //lighten
		var rod = $(this);
		var op = rod.css("opacity");
		rod.css("opacity", op*0.8);
		setTimeout(x => rod.css("opacity", rod.css("opacity")*1.25), 10000);
	} 
	return false;
}

function findNewEl(el, e, newel, rod){
	var trace = el.find(":data(pewiden-trace):first"), p = el.parent(); 
	if(trace.length == 0) 
		trace = el.find(">:only-child");
	if (e.key == "n")   
		newel = trace; //narrow
	else           
		newel = p;     // widen
	if (newel.length == 0 || newel.is("body")) {	
		rod.focus();
		$("body").blur();rod.focus(); 
		return false;
	}
	return newel;
}

function putRodInNewElement(newsel, el, oldsel, newel, rod){
	newsel = selector(newel, 0, false, 0,"Web-Eraser-ed");
	el.data("pewiden-trace","true");
	erasedElementsListCmd("mv", oldsel, newsel);
	newel.before(rod);
	jQuery.data(this,"covererEl", newel);
	markForTheCurtains(el, null, null,"unmark");
	markForTheCurtains(newel, newel[0], newsel);
	rod[0].title = rod[0].title.replace(/\nSelector is:.*\./,"\nSelector is: "+newsel+".");
	measureForCurtains();
	rod.focus();
}

function toggleCurtains() {
	var that = arguments.callee; 
	$(".CurtainRod").each(function(){
		if (!that.xor) {
            manimate( $(".WebEraserCurtain", this),["width", 51,"%"], 2000, 12);
        }
		else
            manimate($(".WebEraserCurtain", this),["width", $(this).data("init-width"),"%"], 4000, 8);
	});
}

function ZaplistComposite() { // Call new ZaplistComposite(); A composite pattern.  4 objs.  Those on zaplist are for complete erasure, but may keep layout.
	if (gobj.iframe) return;
	var zlists = [
        new zaplist(gobj.webpage),
        new zaplist(gobj.website),
        new zaplist(gobj.webpage,"kl"),
        new zaplist(gobj.website,"kl")
    ];
	this.add = function(sel, keep_layout){ 
		zlists.forEach(function(el) { el.add(sel, keep_layout);});
    };

    this.contains = function(el) {                                                              // may be a dom/jq object or a string selector.   
		return zlists.some(function(list) { return list.contains(el);});
    };
    
	this.which = function(el) {                                                                // The 2 bits returned tell if & on which zaplist the elem is.
		if (this.contains(el)) {
			var has_keep_layout = zlists.map(v  =>  v.contains(el)).includes("kl");
			return {
                keep_layout:has_keep_layout,
                zap:!has_keep_layout
            };
		}
		return { keep_layout:false, zap:false };
	};
	this.update = function(sel){
        zlists.forEach(function(el) { el.update();});
    };
	this.toString = () => "[object ZaplistComposite]";
}

function zaplist(key, keytype) { 
	var fullkey = key+":zaplist"+(keytype? ":"+keytype : "");
	var savelist = function() {
        var p = setValue(fullkey, list);
		if (!list.length)
            p = GM_deleteValue(fullkey);
		return p;
	};
	var readlist = function() { return getValue(fullkey,[]); }; 
	var list;   
	
	this.add = async function(str, kl) {
		if (!!kl != !!keytype)
            return;
		list.push(str);
		if((await getValue(key+":erasedElems","")).split(/,/).includes(str)) {
			await savelist();
		}
        else {
            list.pop();
        }
	};
	this.contains = function(jqobjOrStr){
		if (list.length == 0)
            return;
		if (jqobjOrStr.attr)
            jqobjOrStr = jqobjOrStr.attr("selector-this-matched-we");
		if (list.indexOf(jqobjOrStr) != -1)
			return keytype||"zap";
	};
	this.rm = function(str) {
		var i = list.indexOf(str);
		if (i!=-1)
            list.splice(i, 1);
		savelist();
	};
	this.update = async function() { // If sels removed from main list also remove from preferences.zaplists.
		if(!list)
            list = await readlist();
		var strs_ar = getErasedElemsCmd().split(/,/);
		list = list.filter(function (lel) {
			return strs_ar.includes(lel);
		});
		savelist();
	};
	this.toString = () => "[object zaplist]";
}

function moffset(elem, eld = elem[0]) { try{
	if (elem.find("*").addBack().filter(function(){
		return $(this).css("position").includes("fixed");
	}).length )	                                               //    if (elem.css("position").includes("fixed")) 
		return Object.assign(elem.position(),{position:"fixed"});
	var dominPar = elem.offsetParent()[0]; // gets closest element that is positioned (ie, non static);
	return left_top(elem, dominPar);
}    catch(e){ console.log("Error moffset", e); }}	      

function left_top(elem, dominPar) {
	var {left, top}= elem.position(); // something sets & unset margintop or left during something here for some reason, margins and floating els may disaffect calc!
	let margl = parseInt(elem.css('margin-left')), margt = parseInt(elem.css('margin-top'));
	//let bordl = parseInt(elem.css('border-left-width')), bordt = parseInt(elem.css('border-top-width'));
	var x = left + margl, y = top + margt;
	do {
		elem = elem.offsetParent();
		if (elem.is(dominPar) || elem.is("html")) break;
		let {left, top} = elem.position(); // something sets & unset margintop during something here for some reason, margins and floating els may disaffect calc!
		x += left; y += top;
	} while (true)
	if (y) y--;
	return { left: x, top: y };
}

function assertZ(el){
	var dominPar = el.offsetParent();                              	// var tnames = ["transform","-webkit-transform","-webkit-perspective"];
	var tnames = ["transform","perspective"];                         // jquery adds vendor suffixes, eg -webkit-
	el.parentsUntil(dominPar).addBack().each(function(){
		var that = $(this), tforms = that.css(tnames), tf = {};       		// log("assertZ dominpar:", dominPar,"tforms:", tforms);
		if(Object.values(tforms).some(x => !/none/.test(x))) {
			tnames.forEach(name => tf[name] = "none");
			that.css(tf);that.addClass("assertedZ");
		}
	});
}

//
// MutationObserver functions.           Eg, var obs=nodeInsertedListener(document,"#results", myCBfunc);  function myCBfunc(foundArrayOfNodes, DOMparentOfMutation);
// Requires jQuery.
// See https://www.w3.org/TR/dom/#mutationrecord for details of the object sent to the callback for each change.
// Four functions available here:
// Parameter, include_subnodes is to check when .innerHTML add subnodes that do not get included in normal mutation lists, these lower nodes are checked when parameeter is true.
// Return false from callback to ditch out.

function nodeInsertedListener(target, selector, callback, include_subnodes) {
	return nodeMutation(target, selector, callback, 1, include_subnodes);
}
function nodeRemovedListener(target, selector, callback, include_subnodes) {
	return nodeMutation(target, selector, callback, 2, include_subnodes);
}
function nodeMutationListener(target, selector, callback, include_subnodes) { //inserted or removed, callback's 3rd parameter is true if nodes were removed.
	return nodeMutation(target, selector, callback, 3, include_subnodes);
}
function attrModifiedListener(target, selectors, attr, callback) { //attr is array or is not set.  Callback always has same target in each mutrec.
	var attr_obs = new MutationObserver(attrObserver), jQcollection = $(selectors);
	var config = { subtree:true, attributes:true, attributeOldValue:true};
	if (attr) config.attributeFilter = attr;      // an array of attribute names.
	attr_obs.observe(target, config);
	function attrObserver(mutations) {
		//console.log("Attribute mutations");
		var results = mutations.filter(v => { return $(v.target).is(selectors)||$(v.target).is(jQcollection);});
		if (results.length) { //Only send mutrecs together if they have the same target and attributeName.
			let pos = 0;
			results.reduce((prev_res, curr, i) => { if ( prev_res.target!=curr.target || prev_res.attributeName != curr.attributeName) {
				callback(results.slice(pos, i)); pos = i;  } // not really a reduce!
								                    return curr; 
						                          });
			callback(results.slice(pos)); //////////////////<<<<<<<
		} }
	attr_obs.add = function(newmem) { jQcollection = jQcollection.add(newmem); return jQcollection.length; };
	return attr_obs;
}

//
// Internal functions:
function nodeMutation(target, selectors, callback, type, include_subnodes) { //type new ones, 1, removed, 2 or both, 3.
	var node_obs = new MutationObserver(mutantNodesObserver);
	var jQcollection, cnt = 0;
	node_obs.observe(target, { subtree: true, childList: true } );
	return node_obs;
	
	function mutantNodesObserver(mutations) { 
		//console.log("Page node mutations.");
		var sel_find, muts, node;
		jQcollection = $(selectors);
		for(var i = 0; i<mutations.length; i++) {
			if (type!=2) testNodes(mutations[i].addedNodes, mutations[i].target); // target is node whose children changed
			if (type!=1) testNodes(mutations[i].removedNodes, mutations[i].target,"rmed"); // no longer in DOM.
		}
		function testNodes(nodes, ancestor, rmed) { //non jQ use, document.querySelectorAll()
			if (nodes.length == 0) return;
			var results = [], subresults = $();
			for (var j = 0, node; node = nodes[j], j<nodes.length;j++) {
				if (node.nodeType!=1) continue;
				if (jQcollection.is(node)) results.push(node);
				if (include_subnodes) subresults = subresults.add($(node).find(jQcollection));
			}
			results = results.concat(subresults.toArray());
			if (results.length) callback(results, ancestor, rmed);
		} //testNodes()
	};
} 
//
// End MutationObserver functions.  Usage example, var obs=nodeInsertedListener(document,"div.results", myCBfunc);  function myCBfunc(foundArrayOfNodes, ancestorOfMutation);
//



// Animation of curtain closures.

function manimate(objs, [css_attr, target_val, suffix, delay], interval, noOf_subintervals, CB) {
	var len = objs.length,
        cnt = [0],
        intervalId;
	var  [subinterval, plotvals] = doTheMaths(objs, interval, noOf_subintervals, css_attr, target_val);
	var params = { objs, plotvals, cnt, suffix, noOf_subintervals, intervalId, CB, css_attr };
	setTimeout(() => intervalId=
               setInterval(eppurSiMuove, subinterval, params), delay || 0);
} 

function eppurSiMuove(params) { try {             
	if (++params.cnt[0] == params.noOf_subintervals) {     
		clearInterval(params.intervalId);  
		params.CB && params.CB.call(params.objs[1]);
	}
	else requestAnimationFrame(repaintStep);

    function repaintStep(tstamp){
        params.objs.css(params.css_attr, params.plotvals[params.cnt[0]] + params.suffix);           // css attribute stepped thru plotvals
    };  
} catch(e){console.log("WebEraser eppurSiMuove(), error@", e,"objs", params.objs.length, params.objs);}}

function doTheMaths(objs, interval, noOf_subintervals, css_attr, target_val){	

    var maxi = objs.length-1,
        random_element = 3;
    
    
    var subinterval = interval / noOf_subintervals,
	    init_int = parseInt(objs[0].style[css_attr]),                           // assume same initital position and same units/suffix for all objs.
	    delta = (target_val - init_int) / noOf_subintervals,

	    linear = (v, i)  =>  init_int + delta * (i + 1),	                       // quadratic = (v, i) => Math.min(target_val_int, init_int (5/3)*Math.pow(i + 1,/ 2)-(5/3)*(i+1)),	// combo=(v, i) => quad(v, i)/2+linear(v, i)/2,
	    plotvals = new Uint32Array(noOf_subintervals).map(linear);
    
    //console.log("manimate() targets:", objs," requestAnimationFrame:", css_attr,"currval:", objs.css(css_attr), target_val, interval, noOf_subintervals, objs,"plotvals:", plotvals);

	subinterval += random( - subinterval / random_element, subinterval / random_element);           /// Random element +/- 1/random_element.
	return [subinterval, plotvals];
}

async function registerCommands(){
	var reg_args, reg_args2;
	reg_args = ["WebEraser Preferences....     ["+(gobj.elems_to_be_hid?"some erased":"none erased")+"]", erasurePreferences,"","", "E"];
	reg_args2 = ["WebEraser Erase via mouse hover....", eraseIframe,"","", "C"];
	if(registerCommands.done) 
		return;
	if (await regNonGMorPreGM(reg_args, reg_args2) === false) 
		return;                                                   // recalled during lazyload.
	regInContextMenuOrInUserscriptmanager(reg_args, reg_args2);
	registerCommands.done = true;
}

async function regNonGMorPreGM(reg_args, reg_args2){
	if(gobj.dynamic_load_complete && gobj.nonGMmode)
		await useNonGMTMmenus(reg_args, reg_args2);
	if(typeof GM_registerMenuCommand == "undefined")
		return false;
}

async function useNonGMTMmenus(reg_args, reg_args2) {
	await submenuModule.register("WebEraser");
	registerMenuCommand(...reg_args); 
	registerMenuCommand(...reg_args2);
	submenuModule.showMenuIcon();
}

function regInContextMenuOrInUserscriptmanager(reg_args, reg_args2) {
	if(!GM_registerMenuCommand(...reg_args))  // from GM4_registerMenuCommand_Submenu_JS_Module, if there, undefined, else from gm4-polyfill which returns the menuitem DOM object.
		GM.registerMenuCommand(...reg_args); 
	if(!GM_registerMenuCommand(...reg_args2))
		GM.registerMenuCommand(...reg_args2);
}

function sprompt(tex, initv, cancel_btn = "Cancel", ok_btn = "OK", extra_btn, tooltip){ // returns a promise with true/false value or for prompts an array value: [true/false, string], rejected with escape.
	var dialog, p = new Promise((resolve, reject) => {
		dialog = sprompt_inner(tex, initv, resolve, reject, cancel_btn, ok_btn, extra_btn, tooltip);
	});
	p.dialog = dialog;
	return p;
}
function sconfirm(msg, cancelbtnText, okbtnText, extrabtnText, tooltip) { 
	return sprompt(msg, undefined, cancelbtnText, okbtnText, extrabtnText, tooltip); 
}
function salert(msg) { return sprompt(msg, undefined,-1,"OK"); }

//Resolution of promise returned is cancel:false, OK: true, extrabtn: Infinity;

function sprompt_inner(pretext, initval, resolve, reject, cancelbtnText, okbtnText, extrabtnText, tooltip) {try{ // "Cancel" has reply of false or null (if a prompt), "OK" gives reply of true or "", Escape key returns undefined reply.  undefined == null is true. but not for ""
	var that = arguments.callee; if (that.last_dfunc) that.last_dfunc("destroy"); // Only one modal allowed.
	var input_tag, input_style = "width:80%;font-size:small;";
	var confirm_prompt = initval === undefined;
	if (!confirm_prompt) 
		input_tag = initval.length<40 ? "input" : (input_style = "width:95%;height:100px;","textarea");

	var [content, dfunc] = createDcontent(initval, pretext, input_tag, input_style);	
	var dialog = createDialog(content, reject);

	toolTipPevents(tooltip, content);
	setupButtons(cancelbtnText, confirm_prompt, resolve, okbtnText, extrabtnText, dfunc, content);
	checkCancelButton(dialog, cancelbtnText);
	modDialog(dialog, okbtnText, content, that, dfunc);
	return dialog; 

} catch(e) {console.log("hlightAndsetsel(), err", e.lineNumber, e);}}

function createDcontent(initval, pretext, input_tag, input_style) {
	var content=
		    $("<div class = sfswe-content tabindex = 2 style = 'outline:none;white-space:pre-wrap;background:#fff0f0;'>"
		      +"<div class = sfswe-pretext>"+pretext+"</div>" 
		      +(initval !== undefined ? "<"+input_tag+" class = sfs-input spellcheck = 'false' style = '"+input_style+"'  tabindex = '1'></"+input_tag+">":"")+"</div>");
	content.find("input:not(:checkbox), textarea").val(initval);
	var dfunc = content.dialog.bind(content);
	return [content, dfunc];
}
function createDialog(content, reject) {
	var sp1 = $(document).scrollTop();
	var dialog = content.dialog({
		draggable:false, modal: true, width:"auto", resizable: false, position: { my: "center", at: "center", of: unsafeWindow }, // Greater percent further to top.// Position is almost default anyway, difference is use of unsafeWindow due to strange error during prompt in jq in opera violentmonkey
		close: function(e) { 
			dialog.off("keydown"); 
			$(document).scrollTop(sp1); 
			if (e.key == "Escape") reject("Escape");}
	}).parent();
	return dialog;
}


function toolTipPevents(tooltip, content){
	if(tooltip) { content.attr("title", tooltip); } // must set after call content.dialog().
	if ($("body").css("pointer-events") == "none") 
		$("body").css("pointer-events","auto");
}

function checkCancelButton(dialog, cancelbtnText){
	if (cancelbtnText == -1) { 
		dialog.find("button").each(function(){   
			if (this.textContent == "-1") 
				$(this).remove(); 
		}); 
	}
}

function setupButtons(cancelbtnText, confirm_prompt, resolve, okbtnText, extrabtnText, dfunc, content) {
	var buttons = {
		[cancelbtnText]: function(e) { if (confirm_prompt) resolve(false); else resolve([false, $(this).find("input, textarea").val()]); dfunc("close"); return false;},
		[okbtnText]: function(e) { if (confirm_prompt) resolve(true); else resolve([true, $(this).find("input, textarea").val() || ""]); dfunc("close"); return false;}
	};
	if(extrabtnText) 
		buttons[extrabtnText] = function(e) { 
			if (confirm_prompt) 
				resolve(Infinity); 
			else resolve([Infinity, $(this).find("input, textarea").val() || ""]); 
			dfunc("close"); 
			return false;
		};
	content.dialog("option","buttons", buttons);
}

function modDialog(dialog, okbtnText, content, that, dfunc){	
	dialog.wrap("<div class = sfswe-sprompt></div>"); // allows css rules to exclude other jqueryUi css on webpage from own preferences, a
	dialog.keydown(function(e){	
		if (e.key == "Enter" && !/textarea/i.test(e.target.tagName)) 
			$("button:contains("+okbtnText+")", this).click();  
	});
	dialog.css({"z-index":2147483647, width:550, position:"fixed", left:200, top: 50, background: "whitesmoke"}); //"#fff0e0"
	setTitleBar(dialog);
	dialog.draggable({ cancel: ".sfs-input" }); // needs to unset draggable in dialog setup first.
	setTimeout(x => content.focus(), 100);
	that.last_dfunc = dfunc;
}

function setTitleBar(dialog){
	var titlebar = dialog.find(".ui-dialog-titlebar");
	titlebar.find("button").remove(); 
	titlebar.height(8);
	titlebar.add(".sfswe-pretext").css("cursor","move");
}

// Layout/outline of sprompt:
// 
//  <div class=sfswe-prompt>                                    // jQ dialog uses namespace + "-prompt" for class name.
//       <div class='ui-dialog' role=dialog>
//            <div class='sfswe-content ui-dialog-content'>
//                 <div class=sfs-pretext>
//                 <input> or <textarea> of class sfs-input.
//            <div class=ui-dialog-buttonpane>
//

function setValue(n, v) { 
	if (!v) return GM_deleteValue(n);
	else return GM_setValue(n, JSON.stringify(v)); 
}
async function getValue(n, v) { 
	var r1, res = await GM_getValue(n, JSON.stringify(v)); try {
		r1 = JSON.parse(res); return r1; 
	} catch(e) { 
		console.log("getvalue(): Error with key:"+n+" parse of value:"+res+".Value:"+v+".  Error:", e); return v; } }

function deleteValue(n) {
	return setValue(n, null);
}

function random(min, max) {
	return Math.floor(Math.random() * ((max+1) - min)) + min;
}

function csscmp(prevval, newval) {try{
	var that = arguments.callee;
	var covered = {}, roll = "";
	for (let i in prevval) {
		covered[i] = 1;
		if (newval[i] === undefined) roll += "Removed: "+i+" = "+prevval[i]+" ";
		else if (prevval[i] != newval[i]) roll += "Changed: "+prevval[i]+" to: "+newval[i]+" ";
	}
	for (let i in newval) if (!covered[i]) roll += "Added: "+ i +" = "+newval[i] + " ";
	return roll||"Same";
}catch(e) {console.error("csscmp Error", e.lineNumber, e);}}

function nodeInfo(node1, plevel,...nodes) { // show DOM node info or if name/value object list name = value
	//console.log("nodeInfo stack:", logStack());
	if (node1 == undefined || node1.length == 0) return;
	plevel = plevel||1;
	if (isNaN(plevel) && plevel) { nodes.unshift(node1, plevel); plevel = 1; }
	else nodes.unshift(node1);
	plevel--;
	return nodes.map(node =>  {
		if (!node || typeof node == "string") return node;
		if (node && node.attr) node = node[0];
		if (node && node.appendChild) {
			let classn = node.className ? node.className.replace("Web-Eraser-ed","") : "";
			return node ? node.tagName.toLowerCase() + classn.replace(/^\b|\s+(?=\w+)/gi, ".").trim() + (node.id||"").replace(/^\s*\b\s*/,"#")
				+ (plevel>0 ? "<" + nodeInfo(node.parentNode, plevel):"")
			: "<empty>";
		}
		else if (node && node.cssText) return node.cssText;
		else
			return ""+Object.entries(node)      // entries  =>  array of 2 member arrays [[member name, value]...]
			.filter(x =>  isNaN(x[0]) && x[1] )  //Only name value members of object converted to string.
			.map(x => x[0]+":"+x[1]).join(", ");
	}).join(" ");
}
//selector(node, node.parentNode, 0, 0,"Web-Eraser-ed").replace(/^html>body>/,""); }

function logStack(depth){var e = new Error; return e.stack.split(/\n/).slice(2).slice(0, depth);}

function Ppositions(el, incl_self, not_pos_break = "") { 
	el = $(el); var roll = "\n\n";
	var els = el.parents();
	if (incl_self) els = els.add(el).reverse();
	els.each(function(){
		var pos = $(this).css("position");
		roll+=this.tagName+" "+pos+"\n";
		if (! pos.includes(not_pos_break)) return false;
		//       /^((?!relative).)*$/   matches any string, or line w/o \n, not containing the str "relative"
	});
	return roll;
}

function escapeCatch(cbfunc, perm) { // Usage: call first time to install listener & add a callback for keydown of escape key.  Optionally then call many times adding callback functions.  If PERM is set eventlistener is not remove after first Esc.
	var that = escapeCatch;
	if(!that.flist || that.flist.length == 0) {
		that.flist = [cbfunc];
		window.addEventListener("keydown", subfunc, true);
	} 
	else 
		if(cbfunc) { that.flist.push(cbfunc); return; }

	function subfunc(e) { 
		if (e.which == 27)  {
			console.log("escape", perm," is:", that.flist);
			that.flist.forEach(func => func());
			if(perm) return;
			window.removeEventListener("keydown", subfunc, true); 
			that.flist = [];
		}
	} // subfunc();
}


function summarize(longstr, max = 160)  {
	longstr = longstr.toString();
	if (longstr.length<=max) return longstr;
	max = (max-3)/2;
	var begin = longstr.substr(0, max);
	var end = longstr.substr(longstr.length-max, max);
	return begin+" ...●●●●... "+end;
}

async function userscriptManagerInit() { // returns false if GM environment is there, otherwise it calls main when ready and immediately returns true.
	gobj.plat_chrome = false;
	if (/Chrome/.test(navigator.userAgent)) 
		gobj.plat_chrome = true;
	gobj.nonGMmode = false;
	setGMmode();
	if (gobj.nonGMmode) return setUpNonGMmode();
	else return false;             
}

function setGMmode(){	
	try {
		if(typeof GM_getValue == "undefined" || typeof GM_deleteValue == "undefined") {
			check_GM_Support(GM.getValue);
			this.GM_getValue = GM.getValue; // setup getValue for others load polyfill when needed.
			this.GM_setValue = GM.setValue; // ditto.
			this.GM_deleteValue = GM.deleteValue;
			gobj.requires_hdr_str+="@require  https://raw.githubusercontent.com/SloaneFox/code/master/gm4-polyfill.js\n";
		} 
		else check_GM_Support(GM_getValue);
	} catch(e) { gobj.nonGMmode = true; }; //eg, chrom stadalone
}

function check_GM_Support(func) { 
	if (/is not supported[^]{0, 100}$/.test( func.toString() ) )
		throw "GM functions not supported" ; 
}

function setUpNonGMmode(){ 
	console.info("WebEraser userscript in non GM mode at "+location.href); //, "typeof GM:", typeof GM, "nonGMmode", nonGMmode,"-- Using local storage.");
	tryLocalStorage();
	useLocalStorage();		
	gobj.requires_hdr_str+=gobj.nonGmRequires;
	this.GM_registerMenuCommand = x => true; // wait for @require script to define it.
	return true; 
}

function tryLocalStorage(){	
	try { localStorage["anothervariable"] = 32; }	
	catch(e) {
		window.nostorage = true;
		if(!gobj.iframe) console.error("No local storage, no GM storage, use Tampermonkey to include this script on page:", location.href);
		window.localStorage = {};
	}
}

function useLocalStorage(){		
	this.GM_getValue = function(a, b) { return localStorage[a]||b; };
	this.GM_setValue = function(a, b) { localStorage[a] = b; };
	this.GM_deleteValue = function(a) { delete localStorage[a]; };
	this.GM_listValues = function() { return Object.keys(localStorage); };
}
// No need to load all @requires if script doesn't need them on most pages:

async function dynamicLoadRequires() {                                                                         // Do delayed network load of js files, alternative to putting in userscript header, js is only loaded when needed.  Example sites: web.whatsapp.com
	var js_ordered_contents, urls = gobj.requires_hdr_str.replace(/\n\s*\/\//g,"").split(/@require/).slice(1);                // First remove all "<newline><spaces>//", then split on "@require" then remove the 1st element cos it's blank.
	urls = urls.map(str => str.trim());
	js_ordered_contents = await Promise.all(urls.map(fetchOrGetURL));
	evalScriptsInOrder(js_ordered_contents);
    // Would need .call to put jscript declaration such as, "var x" in global scope.	// However, scoped vars such as unsafeWindow, wrapper puts "var unsafeWindow" but window.unsafeWindow or this.unsafeWindow are undefd.
	gobj.dynamic_load_complete = true;
}

async function fetchOrGetURL(url){  // ensures proper order of files for eval.
	try { 
		return (await fetch(url)).text(); 
	} 
	catch(e) { 
		console.error("W/e, failure to fetch", url, e, "Trying GM_xmlhttpRequest");
		var p = pledge();
		doGET(url, p);
		return p;
	} // ps, fetch needs 2 awaits.
}

function doGET(url, p){
	GM_xmlhttpRequest({	
		method: "GET",	url: url, onload: function(response) {
			p.resolver(response.responseText);	
			console.log("xmlHttpRequest res:", response.responseText.substring(0, 20));
		}
	});
}

function evalScriptsInOrder(js_ordered_contents){
	js_ordered_contents.forEach((jscript, i) => {
		console.log("W/e Loading...", jscript.match(/\w.*/)[0], jscript.length);
		eval(jscript);
	});                                    
}

async function getResourceUrl(res_name){ // simply extract url from above resources_hdr_str.
	// if(typeof GM_getResourceURL!="undefined")
	// 	return GM_getResourceURL(res_name);
	// else return GM.getResourceUrl(res_name);
	
	var ar, pos = gobj.resources_hdr_str.indexOf(res_name);
	if(pos!=-1)
		return gobj.resources_hdr_str.substr(pos).split(/\s+/)[1];
}

profileTimer("end globs setup"); //end of outer code whilst main() etc wait for events.

function profileTimer(stage, reset) {
	//return;                               //!! for profiling only.
	if( ! profileTimer[stage])
        profileTimer[stage] = {
            tstamp: performance.now()       //new Date()).getTime()
        };
	if(profileTimer.prev_stage)	{
		let nspaces_tab1 = 40 - profileTimer.prev_stage.length,
            nspaces_tab2 = 30 - stage.length;
        
        let tdiff_ms = performance.now() - profileTimer[profileTimer.prev_stage].tstamp;
        
		console.log("Timer: from", profileTimer.prev_stage + repeat(" ", nspaces_tab1) 
					+ "-------> to "
					+ stage + ":"
                    + repeat(" ", nspaces_tab2),
                    Math.round(tdiff_ms) + "ms");
        }
    
    profileTimer.prev_stage = stage;
    if(reset) {
        console.log("Timer Reset!");
        profileTimer.prev_stage = ""; }
    
	function repeat(char, n) { var roll = char; while(--n > 0) roll+=char; return roll;}
}

function pledge() { // creates a promise with its resolver function as a member.
	var resv, rejr, p = new Promise( (r, j) => { resv = r; rejr = j; } ); p.resolver = resv; p.rejector = rejr;
	return p; 
    // Use case: 	var p = pledge();	setTimeout(x => p.resolver(99), 1000);	await p;
}

function sleep(ms) {
	return new Promise( resolve => setTimeout(resolve, ms));
    // use case:    await sleep(3000);
}



function insertPrototypes()  {
	Number.prototype.in = function(){for (i of Array.from(arguments)) if (this == i) return true;}; // Use brackets with a literal, eg, (2).in(3, 4, 2);
	Number.prototype.inRange = function(min, max){ if (this >=min && this<=max) return true;}; // Ditto.
	Number.prototype.withinRangeOf = function(range, target){ return this.inRange(target-range, target+range); }; // Ditto.
	String.prototype.prefix = function(pfix) { return this.length ? pfix+this : ""+this; };  // prefix given arg if string there.
}

function jqueryui_dialog_css() {
	var sfslink_css = `.sfs-link {      cursor:pointer;  color:navy;    }
	.sfs-link:hover {       text-decoration:underline;   }`;

	return sfslink_css+".ui-dialog-content,.ui-dialog,.ui-dialog textarea { font-size: 16px; font-family: Arial, Helvetica, sans-serif; border: 1px solid #757575; " //+"background:whitesmoke;
		+" color:#335; padding:12px;margin:5px;} "
		+".ui-dialog-buttonpane {  background-color: inherit;width:94%; " //background:whitesmoke;
		+"     font-size: 10px; cursor:move; border: 1px solid #ddd; overflow:hidden; } "
		+".ui-dialog-buttonpane button { background: #f0f0e0; }"
		+".ui-dialog-buttonset { float:right; } "
		+".ui-widget-overlay { background: #aaaaaa none repeat scroll 0 0; opacity: 0.3;height: 100%; left: 0;position: fixed;  top: 0; width: 100%;}"
		+".ui-button,.ui-widget-content { text-align:left; color:#333; border: solid 1px #757575; padding: 6px 13px;margin: 4px 3px 4px 0;} "
		+".ui-corner-all,.ui-dialog-buttonpane {border-bottom-left-radius:30px;}"
		+".ui-button:hover { background-color: #ededed;color:#333; } "
		+".ui-button { background-color: #f6f6f6; color:#333; }"
		+".ui-dialog {position:absolute;padding:3px;outline:none;}"
		+".ui-resizable-handle,.ui-dialog-buttonset, .sfswe-ticks * {  padding:unset;width:auto; font-weight:unset; display:inline; }"  // margin:auto;    Even w/o resizeable being set for dialog, this comes in frmo jq-ui, and at example.org divs are set wildly, the handle is a div.
		+ (str=>str+str.replace(/-moz-/g,"-webkit-"))(
			".sfswe-content :-moz-any(div, input) { font-size:13px;padding:0px;margin: 0;color:#333; opacity:1;  }" //background:whitesmoke; 
				+".sfswe-content :-moz-any(a, a:visited)    { color:#333;text-decoration:underline; padding:0;margin:0;}"
				+".sfswe-content :-webkit-any(a, a:visited) { color:#333;text-decoration:underline; padding:0;margin:0;}"
		)  +".sfswe-content a:hover {opacity:0.5;}"
		+".ui-tooltip { font-size: 7px; }"
		+".sfswe-ticks * {font-size:11px;padding:0px;margin:2px;}"
		.replace(/\.ui/g,".sfswe-sprompt .ui"); //gives namespace of .sfswe-prompt
}

function initGlobalObjects() {
	var userPreferences = {          // set by user, stored persistently.
		page_erasedElems:[],
		site_erasedElems:[],
		config:"", 
		zaplists:""
	};

	var	host = window.document.location.host, pathname = window.document.location.pathname;

	var globalVars = {
		iframe: window!=window.parent, 
		border_width: 6,
		host: host,
		nonGMmode: false,
		pathname: pathname, dynamic_load_complete:false,
		webpage: host+pathname, website:host,  // used as keys for saving/reading user set erasure data.
		tempMode:false, last_ones_deleted:[], delcnt:0, trace_elem:{}, sel_matching_els:[], 
		bblinker:0, rbcl:"sfswe-redborder", tbcl:"sfswe-transparentborder",
		//tab:"&emsp;&emsp;&emsp; &emsp; ", // tab = 5spaces, emsp = 4spaces, but HTML tab in a <pre> wider hence extra emsp's.
		

		elems_to_be_erased:0,

		curtain_icon:"", 
		curtain_slim_icon:"", curtain_xslim_icon:"", 
		ownImageAddr:"", whitecurtains:"", whitecurtainsoriginal:"", whitecurtainstriple:"", whitecurtainsxsm:"", 	curtain_wide_icon:"",
		ignoreIdsDupped:"", curtain_cnt:0,
		overlay:false, plat_chrome:false,

		requires_hdr_str:"",

		nonGmRequires:`
	        @require     https://code.jquery.com/jquery-3.2.1.js
        	@require     https://code.jquery.com/ui/1.12.1/jquery-ui.js
	        @require     https://raw.githubusercontent.com/SloaneFox/code/master/sfs-utils-0.1.6.js
	        @require     https://raw.githubusercontent.com/SloaneFox/code/master/gm-popup-menus-1.4.1.js
        `,
		resources_hdr_str:`
          // @resource    whiteCurtains      https://raw.githubusercontent.com/SloaneFox/imgstore/master/whiteCurtainsDbl.jpg
          // @resource    whiteCurtainsOrig  https://raw.githubusercontent.com/SloaneFox/imgstore/master/whiteCurtains.orig.jpg
          // @resource    whiteCurtainsXsm   https://raw.githubusercontent.com/SloaneFox/imgstore/master/whiteCurtainsExSm.jpg
          // @resource    whiteCurtainsTrpl  https://raw.githubusercontent.com/SloaneFox/imgstore/master/whiteCurtainsTrpl.jpg
        `,
		permanentErasureUserMessage:"Permanently erase selected element(s) from website&mdash;now seen on page red-bordered and blinking?  "
			+"<span title='Clink here to open main preferences window.' class=sfs-link>Preferences...</span>" // Clickable link see call to erasurePreferences in .click() below.
			+"\n\n"
			+"<div style='display:none;; position:relative;width:100%'>"   //inline-block
			+"  <span id=fsfpe-tagel>Internal code for</span><br>"
			+"  <input id=sfswe-seledip disabled style='color:gray;width:80%;margin:10px;'>"
			+"  <div id=sfswe-seledipfull style='position:absolute; left:0; right:0; top:0; bottom:0;'></div>"
			+"</div>",
		permanentErasureUserTooltip:"To refine the choice of what to erase, one can widen or narrow the choice when elements are nested.\nTo invoke this function hit the 'w' and 'n' keys respectively to stagewise widen and narrow your choice."				
			+"The red borders will expand/narrow to show the current selection, if the red borders blink fast, this means it is at its limit.\nSee console for WebEraser info giving chosen element's selector."
	};
	window.log = () => null;  // Script-local vars set in loaded js file.  Declaration here is to ensure it remain local to this userscript.
	return [globalVars, userPreferences];
}
