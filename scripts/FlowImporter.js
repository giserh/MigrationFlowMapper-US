Flox.FlowImporter = ( function(d3) {
	"use strict";

	var my = {};

	function importStateNodes(callback) {
		var stateNodePath = "data/geometry/centroids_states.csv",
			stateNodes = [],
			newStNode,
			stateNodeData,
			row, i; 
			
		d3.csv(stateNodePath, function(d) {
			for (i = 0; i < d.length; i += 1) {
				row = d[i];
				newStNode = new Flox.Point(Number(row.latitude), Number(row.longitude), 1, row.FIPS);
				// Verifying that the node can be projected before adding

				newStNode.STUSPS = row.STUSPS;
				newStNode.FIPS = row.FIPS;
				newStNode.STATEFP = row.FIPS;
				if(isNaN(Number(row.POPDENSITYKM2))) {
					newStNode.populationDensity = "unknown";
				} else {
					newStNode.populationDensity = row.POPDENSITYKM2;
				}
				newStNode.populationDensity = row.POPDENSITYKM2;
				newStNode.population = row.POP2013;
				newStNode.id = row.FIPS;
				newStNode.r = Number(row.radius);
				newStNode.name = row.name;
				newStNode.totalIncomingFlow = 0;
				newStNode.totalOutgoingFlow = 0;
				newStNode.netFlow = 0;
				newStNode.type = "state";
				stateNodes.push(newStNode);
				
			}
			callback(stateNodes);
		});
	}

	function findStateNode(nodes, stateFIPS) {
		var i, j;
		
		for ( i = 0, j = nodes.length; i < j; i += 1) {
			if (Number(nodes[i].STATEFP) === Number(stateFIPS)) {
				return nodes[i];
			}
		}
	}
	
	function findNodeByID(nodes, id) {
		var i, j, nodeID;

		// Can id be converted into a number? If so, do it.
		if(!isNaN(Number(id))) {
			id = Number(id);
		}

		// Loop through the nodes.
		// If node.id matches id, return the node!
		for ( i = 0, j = nodes.length; i < j; i += 1) {
			nodeID = nodes[i].id;
			
			// try converting the nodeID to a number. 
			if(!isNaN(Number(nodeID))) {
				nodeID = Number(nodeID);
			}
						
			if (nodeID === id) {
				return nodes[i];
			}
		}
		console.log(id + " is not in there!");
		return false;
		// It's not in there!
	}

	function importTotalCountyFlowData(flowPath, stateFIPS, countyNodes, callback) {
		d3.csv(flowPath, function(flowData) {
			
			var aFIPS,
			    bFIPS,
			    flow,
			    flows = [],
			    i, j,
			    aPt,
			    bPt,
			    BtoA,
			    AtoB,
			    flowAB,
			    flowBA,
			    row,
			    A_stateFIPS,
			    B_stateFIPS,
			    //startTime = performance.now(),
			    endTime;

			// For each row in the table...
			for ( i = 0, j = flowData.length; i < j; i += 1) {
				row = flowData[i];
				A_stateFIPS = row.placeA_FIPS.slice(0, -3);
				
				if(row.placeB_FIPS.length <= 2) {
					B_stateFIPS = row.placeB_FIPS;
				} else {
					B_stateFIPS = row.placeB_FIPS.slice(0, -3);
				}
				
				// First check if see if this flow has out of state nodes.
				if(Number(A_stateFIPS) !== Number(stateFIPS)) {
					// Place A is out of state.
					// Get the state node for place A.
					aPt = findStateNode(countyNodes, B_stateFIPS);
				} else { // Not out of state. Use the full fips.
					aPt = findNodeByID(countyNodes, row.placeA_FIPS);
				}
				
				if(Number(B_stateFIPS) !== Number(stateFIPS)) {
					// Place B is out of state.
					// Get the state node for place B.
					bPt = findStateNode(countyNodes, B_stateFIPS);
				} else { // Not out of state. Use the full fips.
					bPt = findNodeByID(countyNodes, row.placeB_FIPS);
				}
				
				if (aPt && bPt) { // If both points exist in county nodes...
					BtoA = Number((row.BtoA).replace(",", "")); // Get the value of BtoA flow
					AtoB = Number((row.AtoB).replace(",", "")); // Get the value of AtoB flow
					
					if(isNaN(BtoA) || isNaN(AtoB)) {
						throw new Error("FlowImporter found NaN where there should be a Number.");
					}
					
					flowBA = new Flox.Flow(bPt, aPt, BtoA); // Make the BtoA flow
					flowAB = new Flox.Flow(aPt, bPt, AtoB); // make the AtoB flow
					
					// If the value of BA is bigger than 0...
					if(BtoA > 0) {
						flows.push(flowBA);
						aPt.totalIncomingFlow += BtoA;
						aPt.netFlow += BtoA;
						
						bPt.totalOutgoingFlow += BtoA;
						bPt.netFlow -= BtoA;
					}
					
					if(AtoB > 0) {
						flows.push(flowAB);
						aPt.totalOutgoingFlow += AtoB;
						aPt.netFlow -= AtoB;
						
						bPt.totalIncomingFlow += AtoB;
						bPt.netFlow += AtoB;
					}
				}
			}
			console.log(flows.length + " flows imported for " + stateFIPS);
			//endTime = performance.now() - startTime;
			//console.log("import time: " + endTime);
			callback(flows, countyNodes);
		});
	}


// PUBLIC ---------------------------------------------------------------------


	/**
	 * Imports a CSV file into the model
	 *
	 * @param {string} path File path to CSV.
	 */
	my.importCSV = function(path) {

		// d3 has a convenient csv importer funtion
		d3.csv(path, function(data) {

			var i,
			    j,
			    sLat,
			    sLng,
			    eLat,
			    eLng,
			    value,
			    startPt,
			    endPt,
			    sVal,
			    eVal;

			for ( i = 0,
			j = data.length; i < j; i += 1) {
				// For every line, build a flow
				sLng = Number(data[i].lng0);
				sLat = Number(data[i].lat0);
				sVal = Number(data[i].val0);
				eLng = Number(data[i].lng1);
				eLat = Number(data[i].lat1);
				eVal = Number(data[i].val1);
				value = Number(data[i].value);

				startPt = new Flox.Point(sLat, sLng, sVal);
				endPt = new Flox.Point(eLat, eLng, eVal);

				Flox.addFlow(new Flox.Flow(startPt, endPt, value));
			}

			// Refresh the map. This will wait until the .csv is fully loaded.
			// This is because it is placed within the d3.csv() function.
			// If FloxController called refreshmap, it would run before
			// the CSV is fully loaded. D3 creates this delay here.
			Flox.sortFlows();

			Flox.setFilteredFlows();

			Flox.layoutFlows();

			Flox.refreshMap(); // FIXME this should happen in a callback.
		});
	};

	/**
	 * Imports a CSV file containing formatted US Census county centroids to
	 * be used as nodes for county-to-county flow data.
	 * Only imports county nodes for the state designated by stateFIPS. 
 * @param {Object} nodePath : Path to CSV
 * @param {Object} callback : Called after CSV is fully imported, with the 
 * imported nodes as an argument.
	 */
	my.importUSCensusCountyNodes = function(nodePath, stateFIPS, callback) {
		
		// import state nodes. Will be used to replace nodes outside of the
		// target state (stateFIPS).
		var newStNode,
			stateNodeData,
			row, i;
			
		// Import state nodes first. State nodes will replace county nodes that
		// are out side of the target state.
		importStateNodes(function(nodes) {
			// Import county nodes.
			d3.csv(nodePath, function(nodeData) {
				var newPt;
				
				for ( i = 0; i < nodeData.length; i += 1) {
				    row = nodeData[i];
				    
					// Is the node in-state?
					// If so, add it. 
					if(Number(row.STATEFP) === Number(stateFIPS)) {
						// It's in-state, or there isn't a state node for it.
						newPt = new Flox.Point(Number(row.latitude), Number(row.longitude), 1, row.FIPS);

						// new point migth not have an xy if the latLng is outside the
						// d3 projection boundary, which causes errors. Don't add it to 
						// nodes if so. Flows with these point's won't be added to the 
						// model.
						// FIXME Use a projection that enables showing everything?
						//if (newPt.x && newPt.y) {
							newPt.STUSPS = row.STUSPS;
							newPt.STATEFP = row.STATEFP;
							newPt.name = row.NAME + " " + row.TYPE;
							newPt.populationDensity = row.POPDENSITYKM2;
							newPt.population = row.POPESTIMATE2014;
							newPt.totalIncomingFlow = 0;
							newPt.totalOutgoingFlow = 0;
							newPt.netFlow = 0;
							newPt.type = "county";
							nodes.push(newPt);
						//}	
					}
				}				
				callback(nodes);
			});
		});
	};

	/**
	 * Imports the US Census county to county migration flows for one state.
 * @param {Object} stateFIPS : FIPS of selected state
 * @param {Object} callback : Passes along imported flows and nodes.
	 */
	my.importTotalCountyFlowData = function(stateFIPS, callback) {	
		
		var nodePath = "data/geometry/centroids_counties_all.csv",
			flowPath = "data/census/flows/" + stateFIPS + "_net_mergedOuterFlows.csv";
			
		// Import nodes for all counties
		my.importUSCensusCountyNodes(nodePath, stateFIPS, function(countyNodes) {
			// countyNodes is the imported nodes!
			importTotalCountyFlowData(flowPath, stateFIPS, countyNodes, function(flows) {
				// flows are the imported flows!
				callback(flows, countyNodes);
			});
		});
	};

	/**
	 * Imports the US Census state to state migration flows
	 */
	my.importStateToStateMigrationFlows = function(flowPath, callback) {
		// Arrays to store the stuff
		var flows = [];

		// Import state nodes
		importStateNodes(function(nodes){
			
			// Import the state flows data, link it to the nodes.
			d3.csv(flowPath, function(flowData) {

				var endID,
				    startID,
				    flow, val, endPt, startPt,
				    i;

				// For each row in the table...
				for ( i = 0; i < flowData.length; i += 1) {

					// find the nodes. 
					startPt = findNodeByID(nodes, flowData[i].from);
					endPt = findNodeByID(nodes, flowData[i].to);
					val = Number(flowData[i].value);

					if (startPt && endPt) {
						if (val > 0) {
							flows.push(new Flox.Flow(startPt, endPt, val));
							startPt.totalOutgoingFlow += val;
							startPt.netFlow -= val;					
							endPt.totalIncomingFlow += val;
							endPt.netFlow += val;
						}
					}
				}
				callback(flows, nodes);
			});
		});
	};

	return my;
}(d3));
