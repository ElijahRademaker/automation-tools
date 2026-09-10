document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("processButton").addEventListener("click", () => {
	const fileInput = document.getElementById("fileInput");
	const file = fileInput.files[0];
	if (file) {
		const reader = new FileReader();
		reader.onload = function(event) {
			try {
				let jsonString = event.target.result;
				jsonString = jsonString.replace(/"Temporary Traffic Control Plan Required":\s*,/g, '"Temporary Traffic Control Plan Required": "",');
				jsonString = jsonString.replace("\"\t", "\"");
				const jsonData = JSON.parse(jsonString);
				chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
					const tabId = tabs[0].id;
					chrome.scripting.executeScript({
						target: { tabId: tabId },
						func: readHeaders
					}, (results) => {
						const headers = results[0]?.result
						chrome.scripting.executeScript({
						target: { tabId: tabId },
						func: manipulateDOM,
						args: [jsonData, headers]
						});
					});
				});
			} catch (error) {
				alert("Invalid JSON:", error);
			}
        };
		
		reader.readAsText(file);
      } else {
		alert("Please select a JSON file.");
      }
    });
  });
  

function readHeaders(){
    const dictionary = {}
	
	const wordsToCheck = ['spidastudio', 'projectmanager', '/manager'];
	for (const word of wordsToCheck) {
	  if (!window.location.href.includes(word)) {
		alert("Not on the correct page, go to SPIDAstudio Dashboard and select a project")
		process.exit();
	  }
	}
	
	let tableFound = false
	document.querySelectorAll('.ember-view.button.tiny.active').forEach((element) => {
		if (element.outerText.trim() == "Table") {
			tableFound = true
		}
	});
	if (!tableFound) {
		alert("Not on the correct tab, go to table view")
		process.exit();
	}
	
	let stationRowsFound = false
	document.querySelectorAll('.ember-view.button.tiny.active').forEach((element) => {
		if (element.outerText.trim() == "Station Rows") {
			stationRowsFound = true
		}
	});
	if (!stationRowsFound) {
		alert("Select Station Rows")
		process.exit();
	}
	
	let editFound = false
	document.querySelectorAll('.fi-pencil.small-icon-button').forEach((element) => {
		if (element.parentElement.parentElement.outerText.trim() == "Forms:") {
			editFound = true
		}
	});
	if (editFound) {
		alert("Enable edit forms mode with the pencil icon")
		process.exit();
	}
	
    for (let i = 1; i < document.querySelector('tr').cells.length; i++) {
        if (document.querySelector('tr').cells[i].childNodes[2].innerText == "Make Ready Status" 
			|| document.querySelector('tr').cells[i].childNodes[2].innerText == "Pole Details"
			|| document.querySelector('tr').cells[i].childNodes[2].innerText == "Pole Inspection Details"
			|| document.querySelector('tr').cells[i].childNodes[2].innerText == "Proposed Attachment Details - New Cable" 
			|| document.querySelector('tr').cells[i].childNodes[2].innerText == "Proposed Attachment Details - Overlash" 
			|| document.querySelector('tr').cells[i].childNodes[2].innerText == "Proposed Attachment Details - Antenna" 	
			|| document.querySelector('tr').cells[i].childNodes[2].innerText == "NJUNS") {
				dictionary[document.querySelector('tr').cells[i].childNodes[4].innerText] = [i]
		} else {
			dictionary[document.querySelector('tr').cells[i].childNodes[2].textContent] = [i]
		}
    }
	
	const row = document.querySelector('tr');

if (row && row.cells && row.cells.length > 1) {
  
} else {
  alert('The <tr> element or its cells do not exist, or there are not enough cells.');
}
	
	if (!dictionary["Status"]) {
		alert("Please make sure the \"Status\" column is visible.\n\nPress the \"Select Columns\" button and then find the \"Status\" option  and check it off as visible. Make sure to hit save and then try again!")
		throw new Error("An error occurred! Stopping execution.");
	}
	if (!dictionary["Pole Order"]) {
		alert("Please make sure the \"Pole Order\" column is visible.\n\nPress the \"Select Columns\" button and make sure the \"Display Required Fields and Additional Selections\" option is selected, then scroll down to the \"Pole Order\" option and check it off as visible. Make sure to hit save and then try again!")
		throw new Error("An error occurred! Stopping execution.");
	}
	if (!dictionary["Primary Tag"]) {
		alert("Please make sure the \"Primary Tag\" column is visible.\n\nPress the \"Select Columns\" button and then find the \"Primary Tag\" option and check it off as visible. Make sure to hit save and then try again!")
		throw new Error("An error occurred! Stopping execution.");
	}

    return dictionary
}

async function manipulateDOM(jsonData, headers) {
	const invalidStatuses = [
		"Field Engineering - Assignment",
		"Pull Data from GIS"
	];
	const validStatuses = [
		"Field Engineering in Progress",
		"Field Eng Complete",
		"Ready for CE Review",
		"Design Review",
		"Comm Attachment and Make Ready Details",
		"Generate NJUNS Ticket"
	];
	const phaseOneStatuses = [
		"Field Engineering in Progress",
		"Field Eng Complete",
		"Ready for CE Review",
		"Design Review"
	]; 
	const phaseTwostatuses = [
		"Comm Attachment and Make Ready Details",
		"Ready for CE Review",
		"Design Review"
	];
	const phaseThreeStatuses = [
		"Generate NJUNS Ticket",
		"Ready for CE Review",
		"Design Review"
	];

	const input_event = new Event("input", {bubbles:true})
	const click_event = new Event("click", {bubbles:true})
	const enter_event = new KeyboardEvent('keydown', {
			key: 'Enter',
			keyCode: 13, 
			code: 'Enter',
			which: 13,   
			bubbles: true 
		});
	const down_key_event = new KeyboardEvent('keydown', {
			key: 'ArrowDown',   
			keyCode: 40,        
			code: 'ArrowDown',  
			which: 40,          
			bubbles: true       
		});
	const up_key_event = new KeyboardEvent('keydown', {
			key: 'ArrowUp',   
			keyCode: 38,        
			code: 'ArrowUp',  
			which: 38,          
			bubbles: true       
		});
	let missing_poles = []
	let wrong_status_poles = []
	
	let foundPoles = 0
	let poleStatuses = {}
	let invalidPhase = false
	let phaseOne = false
	let phaseTwo = false
	let phaseThree = false
	
	for (const row of document.querySelectorAll('tr.data-row:not(.bulk-edit-row)')) {
		let pole_number = row.cells[headers["Pole Order"]]?.childNodes[6]?.childNodes[1]?.childNodes[3]?.childNodes[2]?.value.trim().replace(/^0+/, "")
		let ceid = row.cells[headers["Primary Tag"]].innerText
		let pole = jsonData.Poles[pole_number]
		let pole_status = row.cells[headers["Status"]].innerText
		if (!pole) {
			pole = Object.values(jsonData.Poles).find(pole => pole["Pole CEID"] === ceid);
		}
		if (pole) {
			poleStatuses[pole_status] = true
			if (pole_status === "Field Engineering in Progress" || pole_status === "Field Eng Complete") {phaseOne = true;}
			if (pole_status === "Comm Attachment and Make Ready Details") {phaseTwo = true;}
			if (pole_status === "Generate NJUNS Ticket") {phaseThree = true;}
			if (invalidStatuses.includes(pole_status)) {invalidPhase = true;}
		} 
	}
	
	let currentPhase
	if (phaseOne && !phaseTwo && !phaseThree && !invalidPhase) {
		currentPhase = "One";
	} else if(!phaseOne && phaseTwo && !phaseThree && !invalidPhase){
		currentPhase = "Two";
	} else if (!phaseOne && !phaseTwo && phaseThree && !invalidPhase){
		currentPhase = "Three";
	} else if (invalidPhase) {
		currentPhase = "Invalid";
	} else {
		currentPhase = "All";
	}
	
	if (currentPhase !== "Invalid") {
		for (const row of document.querySelectorAll('tr.data-row:not(.bulk-edit-row)')) {
			let pole_number = row.cells[headers["Pole Order"]]?.childNodes[6]?.childNodes[1]?.childNodes[3]?.childNodes[2]?.value.trim().replace(/^0+/, "");
			let ceid = row.cells[headers["Primary Tag"]].innerText;
			let pole = jsonData.Poles[pole_number];
			let pole_status = row.cells[headers["Status"]].innerText;
			if (!pole) {
				pole = Object.values(jsonData.Poles).find(pole => pole["Pole CEID"] === ceid);
			}
			if (pole && validStatuses.includes(pole_status)) {
				if ((currentPhase === "One" || currentPhase === "All") && phaseOneStatuses.includes(pole_status)) {
					foundPoles++;
				} else if ((currentPhase === "Two" || currentPhase === "All") && phaseTwostatuses.includes(pole_status)) {
					foundPoles++;
				} else if ((currentPhase === "Three" || currentPhase === "All") && phaseThreeStatuses.includes(pole_status)) {
					foundPoles++;
				}
			}
		}
	}
	
	let forestryRequired = false;
	let n = 1;
	while (true) {
		const key = `TreeForestryEstimate${n}`;

		if (!(key in jsonData)) break;

		const value = jsonData[key];
		if (typeof value === 'string' && value.length > 0 && value[0].toLowerCase() === 'y') {
			forestryRequired = true;
			break;
		}
		n++;
	}
	
	if (foundPoles > 0) {
		alert(`${foundPoles} poles found for phase: ${currentPhase}.`);
		
		if (currentPhase === "One") {
			if (jsonData["Inspected By"]) {
				if (!document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspected By"]].childNodes[2].childNodes[2].readyOnly) {
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspected By"]].childNodes[2].childNodes[2].value = jsonData["Inspected By"]
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspected By"]].childNodes[2].childNodes[2].dispatchEvent(input_event)
				}
			}
			if (jsonData["Data Collection Date"]) {
				const date = jsonData["Data Collection Date"].split('/').map(num => String(Number(num)));
				
				if (document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].childNodes[4].type == "text") {
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].childNodes[4].dispatchEvent(click_event)
					
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].children[0].children[0].childNodes[1].childNodes[1].childNodes[0].childNodes[0].dispatchEvent(enter_event)
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = date[2]
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].children[0].children[0].childNodes[1].childNodes[1].childNodes[0].childNodes[0].dispatchEvent(enter_event)

					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].children[1].children[0].childNodes[1].childNodes[1].childNodes[0].childNodes[0].dispatchEvent(enter_event)
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date[0]- 1];
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].children[1].children[0].childNodes[1].childNodes[1].childNodes[0].childNodes[0].dispatchEvent(enter_event)
						
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].children[2].children[0].childNodes[1].childNodes[1].childNodes[0].childNodes[0].dispatchEvent(enter_event)
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = date[1]
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
					document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
					document.querySelector('tr.data-row.bulk-edit-row').cells[headers["Inspection Date"]].childNodes[2].childNodes[2].children[2].children[0].childNodes[1].childNodes[1].childNodes[0].childNodes[0].dispatchEvent(enter_event)
				}
			}
		}
	}

	const popup = document.createElement("div");
	popup.style.position = "fixed";
	popup.style.top = "20px";
	popup.style.left = "50%";
	popup.style.transform = "translateX(-50%)";
	popup.style.background = "white";
	popup.style.padding = "10px";
	popup.style.border = "1px solid black";
	popup.style.zIndex = "9999";

	const bar = document.createElement("progress");
	bar.value = 0;
	bar.max = foundPoles;
	bar.style.width = "300px";

	popup.appendChild(bar);
	document.body.appendChild(popup);
	await new Promise(r => requestAnimationFrame(r));
	
	for (const row of document.querySelectorAll('tr.data-row:not(.bulk-edit-row)')) {
		let pole_number = row.cells[headers["Pole Order"]]?.childNodes[6]?.childNodes[1]?.childNodes[3]?.childNodes[2]?.value.trim().replace(/^0+/, "")
		let ceid = row.cells[headers["Primary Tag"]].innerText
		let pole = jsonData.Poles[pole_number]
		let pole_status = row.cells[headers["Status"]].innerText
		if (!pole) {
			pole = Object.values(jsonData.Poles).find(pole => pole["Pole CEID"] === ceid);
		} 
		if (pole) {
			if (invalidStatuses.includes(pole_status)) {
				wrong_status_poles.push(`Pole: ${pole_number} - ${ceid} wrong status, push to next status`)
			} else {
				for (key in headers) {
					let whileEscape = 0
					let escapeBox
					if (!row.cells[headers[key]].childNodes[6].hasChildNodes())
						continue
					let current_field = row.cells[headers[key]].childNodes[6].childNodes[1].childNodes[3].childNodes[2]
					if ((currentPhase === "One" || currentPhase === "All") && phaseOneStatuses.includes(pole_status)) {
						switch(key) {
							case "Pole Denied?":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = (pole["Attachment Denied"] ? "Yes" : "No")
								document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "Pole Denial Reason":
								if ("Pole Denial Reason" in pole) {
									current_field.value = pole["Pole Denial Reason"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Pole Owner":
								if ("Pole Owner" in pole) {
									current_field.value = pole["Pole Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Pole Height":
								if (pole["Pole Height"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = pole["Pole Height"]
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								}
								break;
							case "Pole Class":
								if (pole["Pole Class"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = pole["Pole Class"]
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								}
								break;
							case "Pole Species":
								if (pole["Pole Species"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
									let species = pole["Pole Species"]
									if (species.toUpperCase().includes("WRC")) {
										species = "WC"
									} else if (species.toUpperCase().includes("WESTERN")) {
										species = "WC"
									} else if (species.toUpperCase().includes("FIR")) {
										species = "DF"
									} else if (species.toUpperCase().includes("DOUGLAS")) {
										species = "DF"
									}
									
									if (species != "WC" && species != "DF") {
										spcies = "SP"
									}
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = species
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								}
								break;
							case "Framing Type":
								if (pole["Framing Type"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = pole["Framing Type"]
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								}
								break;
							case "Equipment":
								if (pole["Equipment"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].value = pole["Equipment"]
									document.querySelectorAll('.select2-search__field')[document.querySelectorAll('.select2-search__field').length - 1].dispatchEvent(input_event)
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								}
								break;
							case "Existing Height of Lowest Power Attachment":
								if ("Existing Height of Lowest Power Attachment" in pole) {
									current_field.value = pole["Existing Height of Lowest Power Attachment"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Height of Streetlight from bottom of bracket (20\" to comm req)":
								if ("Existing Height of Streetlight from bottom of bracket" in pole) {
									current_field.value = pole["Existing Height of Streetlight from bottom of bracket"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "New Attachment - Owner":
								break;
							case "New Attachment - Attach Height (Ex 22'6\") 16' Minimum":
								if ("New Attachment - Attach Height" in pole) {
									current_field.value = pole["New Attachment - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "New Attachment - Midspans 15'6\" Minimum":
								if ("New Attachment - Midspans" in pole) {
									current_field.value = pole["New Attachment - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 1 - Owner":
								if ("Existing Attacher 1 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 1 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 1 - Attach Height":
								if ("Existing Attacher 1 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 1 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 1 - Midspans":
								if ("Existing Attacher 1 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 1 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 2 - Owner":
								if ("Existing Attacher 2 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 2 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 2 - Attach Height":
								if ("Existing Attacher 2 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 2 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 2 - Midspans":
								if ("Existing Attacher 2 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 2 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 3 - Owner":
								if ("Existing Attacher 3 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 3 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 3 - Attach Height":
								if ("Existing Attacher 3 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 3 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 3 - Midspans":
								if ("Existing Attacher 3 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 3 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 4 - Owner":
								if ("Existing Attacher 4 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 4 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 4 - Attach Height":
								if ("Existing Attacher 4 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 4 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 4 - Midspans":
								if ("Existing Attacher 4 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 4 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 5 - Owner":
								if ("Existing Attacher 5 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 5 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 5 - Attach Height":
								if ("Existing Attacher 5 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 5 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 5 - Midspans":
								if ("Existing Attacher 5 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 5 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 6 - Owner":
								if ("Existing Attacher 6 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 6 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 6 - Attach Height":
								if ("Existing Attacher 6 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 6 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 6 - Midspans":
								if ("Existing Attacher 6 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 6 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 7 - Owner":
								if ("Existing Attacher 7 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 7 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 7 - Attach Height":
								if ("Existing Attacher 7 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 7 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 7 - Midspans":
								if ("Existing Attacher 7 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 7 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 8 - Owner":
								if ("Existing Attacher 8 - Owner" in pole) {
									current_field.value = pole["Existing Attacher 8 - Owner"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 8 - Attach Height":
								if ("Existing Attacher 8 - Attach Height" in pole) {
									current_field.value = pole["Existing Attacher 8 - Attach Height"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 8 - Midspans":
								if ("Existing Attacher 8 - Midspans" in pole) {
									current_field.value = pole["Existing Attacher 8 - Midspans"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Clearance Requirement (please specify all To Poles)":
								if (pole["Clearance Requirement"]) {
									current_field.value = pole["Clearance Requirement"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Room to guy? (If no please specify if guying comments below)":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								if (!pole["Room to Guy"])
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "Guying Comments":
								if (pole["Guying Comments"]) {
									current_field.value = pole["Guying Comments"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "As-Is Pole Loading %":
								if (pole["As-Is %"]) {
									current_field.value = pole["As-Is %"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "New App Pole Loading %":
								if (pole["New App %"]) {
									current_field.value = pole["New App %"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Violation Cost Estimate - ALT 2":
								if (pole["Alt 2 Cost"]) {
									current_field.value = pole["Alt 2 Cost"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Make Ready Cost Estimate - ALT 3":
								if (pole["Alt 3 Cost"]) {
									current_field.value = pole["Alt 3 Cost"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Total Cost Estimate":
								if (pole["Total Alt Cost"]) {
									current_field.value = pole["Total Alt Cost"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "CE Work - Violations":
								current_field = current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0]
								whileEscape = 0
								escapeBox = null
								while (whileEscape < 1000 && current_field.querySelectorAll('.select2-selection__choice__remove').length > 0) {
									current_field.querySelectorAll('.select2-selection__choice__remove').forEach(function(element) {
									escapeBox = element.parentElement.parentElement
									element.click();
									whileEscape++;
								})};
								if (escapeBox) {escapeBox.click()}
								index = current_field.childNodes.length - 1
								if (pole["CE Work - Violations - Emergency Work"]) {
									current_field.childNodes[index].childNodes[0].value = "Emergency Work"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
						
								} if (pole["CE Work - Violations - Pole Loading"]) {
									current_field.childNodes[index].childNodes[0].value = "Pole Loading"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								
								} if (pole["CE Work - Violations - Safety Zone Violation"]) {
									current_field.childNodes[index].childNodes[0].value = "Safety Zone Violation"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - Midspan Seperation"]) {
									current_field.childNodes[index].childNodes[0].value = "Mid Span Separation"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - Deterioration"]) {
									current_field.childNodes[index].childNodes[0].value = "Deterioration"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - Missing or Broken CE Strain Ins"]) {
									current_field.childNodes[index].childNodes[0].value = "Missing or Broken CE Strain Ins"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - Missing or Broken CE Guy Marker"]) {
									current_field.childNodes[index].childNodes[0].value = "Missing or Broken CE Guy Marker"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - Missing or Broken Guys"]) {
									current_field.childNodes[index].childNodes[0].value = "Missing or Broken Guys"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - Missing or Broken STL Molding"]) {
									current_field.childNodes[index].childNodes[0].value = "Missing or Broken STL Molding"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - UnBonded Streetlight"]) {
									current_field.childNodes[index].childNodes[0].value = "Unbonded Streetlight"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Work - Violations - Other"]) {
									current_field.childNodes[index].childNodes[0].value = "Other"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								}
								break;
							case "Communications Work - Violations":
								current_field = current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0]
								whileEscape = 0
								escapeBox = null
								while (whileEscape < 1000 && current_field.querySelectorAll('.select2-selection__choice__remove').length > 0) {
									current_field.querySelectorAll('.select2-selection__choice__remove').forEach(function(element) {
									escapeBox = element.parentElement.parentElement
									element.click();
									whileEscape++;
								})};
								if (escapeBox) {escapeBox.click()}
								index = current_field.childNodes.length - 1
								if (pole["Communication Work - Violations - Separation"]) {
									current_field.childNodes[index].childNodes[0].value = "Separation"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
						
								} if (pole["Communication Work - Violations - Clearance"]) {
									current_field.childNodes[index].childNodes[0].value = "Clearance"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Communication Work - Violations - Illegal Equipment"]) {
									current_field.childNodes[index].childNodes[0].value = "Illegal Equipment"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Communication Work - Violations - Illegal Anchor"]) {
									current_field.childNodes[index].childNodes[0].value = "Illegal Anchor"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Communication Work - Violations - Missing or Broken CE Strain Ins"]) {
									current_field.childNodes[index].childNodes[0].value = "Missing or Broken Strain insultator"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Communication Work - Violations - Missing or Broken CE Guy Marker"]) {
									current_field.childNodes[index].childNodes[0].value = "Missing or Broken Guy Marker"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Communication Work - Violations - Missing or Broken Guys"]) {
									current_field.childNodes[index].childNodes[0].value = "Missing or Broken Guy"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(down_key_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								}  if (pole["Communication Work - Violations - Other"]) {
									current_field.childNodes[index].childNodes[0].value = "Other"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								}
								break;
							case "Make Ready Work Comments":
								if (pole["Make Ready Work Comments"]) {
									current_field.value = pole["Make Ready Work Comments"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "New Attachment Status Summary":
								current_field = current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0]
								whileEscape = 0
								escapeBox = null
								while (whileEscape < 1000 && current_field.querySelectorAll('.select2-selection__choice__remove').length > 0) {
									current_field.querySelectorAll('.select2-selection__choice__remove').forEach(function(element) {
									escapeBox = element.parentElement.parentElement
									element.click();
									whileEscape++;
								})};
								if (escapeBox) {escapeBox.click()}
								index = current_field.childNodes.length - 1
								if (pole["Ok to Attach Before Work"]) {
									current_field.childNodes[index].childNodes[0].value = "OK to Attach Before Work"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Work Required Before Attach"]) {
									current_field.childNodes[index].childNodes[0].value = "Work Required Before Attach"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE to Correct Violations"]) {
									current_field.childNodes[index].childNodes[0].value = "CE to Correct Violations"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Comm to Correct Violations"]) {
									current_field.childNodes[index].childNodes[0].value = "Comm to Correct Violations"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Maintenance Work Required"]) {
									current_field.childNodes[index].childNodes[0].value = "CE Maintenance Work Required"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["CE Make Ready Work Required"]) {
									current_field.childNodes[index].childNodes[0].value = "CE Make Ready Work Required"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Com. Make Ready Work Required"]) {
									current_field.childNodes[index].childNodes[0].value = "Comm Make Ready Work Required"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Attachment Denied"]) {
									current_field.childNodes[index].childNodes[0].value = "Attachment"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} if (pole["Foriegn Pole"]) {
									current_field.childNodes[index].childNodes[0].value = "Foreign Pole"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
								} 
								break;
							case "Alt Designs":
								current_field = current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0]
								whileEscape = 0
								escapeBox = null
								while (whileEscape < 1000 && current_field.querySelectorAll('.select2-selection__choice__remove').length > 0) {
									current_field.querySelectorAll('.select2-selection__choice__remove').forEach(function(element) {
									escapeBox = element.parentElement.parentElement
									element.click();
									whileEscape++;
								})};
								if (escapeBox) {escapeBox.click()}
								index = current_field.childNodes.length - 1
								if (pole["Alt Designs"].includes('1')) {
									current_field.childNodes[index].childNodes[0].value = "Alt 1"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									index = current_field.childNodes.length - 1
									if (pole["Alt Designs"].includes('2')) {
										current_field.childNodes[index].childNodes[0].value = "Alt 2"
										current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
										current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
										current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
										current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
										index = current_field.childNodes.length - 1 
									} if (pole["Alt Designs"].includes('3')) {
										current_field.childNodes[index].childNodes[0].value = "Alt 3"
										current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
										current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
										current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
										current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
										index = current_field.childNodes.length - 1
									}
								} else {
									current_field.childNodes[index].childNodes[0].value = "N/A"
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(input_event)
									current_field.childNodes[index].childNodes[0].dispatchEvent(enter_event)
								}
								break;
						}					
					}  
					if ((currentPhase === "Two" || currentPhase === "All") && phaseTwostatuses.includes(pole_status)) {
						switch(key) {
							case "Requires Safety Clearance/Corrective Action Child Project?":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break
							case "Tree Trimming Required?":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								if (!pole["Tree Trimming Required"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								}
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "FORC Required?":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								if (!pole["Tree Trimming Required"] || !forestryRequired) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								}
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "NJUNS Ticket Required for Pole Transfer?":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								if (!pole["NJUNS"].toLowerCase().includes("pt")) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								}
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "Outage Management Required?":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								if (!pole["Outage Management Required"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								}
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "Site Coordination Required?":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								if (!pole["Site Coordination Required"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								}
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "Temporary Traffic Control Plan":
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(up_key_event)
								if (!pole["CE to Correct Violations"] && !pole["Location"]) {
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
									current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(down_key_event)
								}
								current_field.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].dispatchEvent(enter_event)
								break;
							case "Existing Attacher 1 - Attachment Modification":
								if ("Existing Attacher 1 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 1 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 2 - Attachment Modification":
								if ("Existing Attacher 2 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 2 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 3 - Attachment Modification":
								if ("Existing Attacher 3 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 3 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 4 - Attachment Modification":
								if ("Existing Attacher 4 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 4 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 5 - Attachment Modification":
								if ("Existing Attacher 5 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 5 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 6 - Attachment Modification":
								if ("Existing Attacher 6 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 6 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 7 - Attachment Modification":
								if ("Existing Attacher 7 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 7 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
							case "Existing Attacher 8 - Attachment Modification":
								if ("Existing Attacher 8 - Attachment Modification" in pole) {
									current_field.value = pole["Existing Attacher 8 - Attachment Modification"]
									current_field.dispatchEvent(input_event)
								}
								break;
						}
					}
					if ((currentPhase === "Three" || currentPhase === "All") && phaseThreeStatuses.includes(pole_status)) {
						if (key == "NJUNS Ticket Number" && pole_status == "Generate NJUNS Ticket") {
							current_field.value = pole["NJUNS"].replace(/\D/g, '');
							current_field.dispatchEvent(input_event)
						}
					}
				}
				if(validStatuses.includes(pole_status)) {
					bar.value++;
					await new Promise(r => requestAnimationFrame(r));
				}
			}	
		} else {
			missing_poles.push(`Pole: ${pole_number} - ${ceid} missing from JSON`)
		}
	}
	popup.remove();
	alert("Finished SPIDAstudio Autofill\n" + [...missing_poles, ...wrong_status_poles].join('\n'));
}

