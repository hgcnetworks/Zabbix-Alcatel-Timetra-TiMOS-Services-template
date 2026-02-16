// Zabbix LLD preprocessor for SDP Binding (Service Distribution Point) discovery on Nokia SR-OS.
// Decodes compound SNMP indexes to extract SDP IDs and VC IDs, then resolves
// far-end IPs, service names, and customer info from TIMETRA-SERV-MIB walks.

var input = JSON.parse(value);
// Service type value mapping (TmnxServType from TIMETRA-SERV-MIB)
var svcTypeMap = {"0":"unknown","1":"epipe","3":"vpls","4":"vprn","5":"ies","6":"mirror","7":"apipe","8":"fpipe","9":"ipipe","10":"cpipe","11":"intTls","12":"evpnIsaTls"};
var services = {};
var svcTypes = {};
var svcDescs = {};
var sdpIps = {};
var sdpEntries = [];
var svcCustomers = {};
var customers = {};
var output = [];

// Phase 1: Build lookup tables from the flat SNMP discovery results.
// Each item carries only one useful field; we sort them into maps keyed by SNMP index.
input.forEach(function (item) {
    var idx = item["{#SNMPINDEX}"];

    // Service name — prefer descriptive name, fall back to numeric ID
    if (item["{#SVC_NAME}"]) { services[idx] = item["{#SVC_NAME}"]; }
    // Service type — map numeric value to name (TmnxServType)
    if (item["{#SVC_TYPE}"]) { svcTypes[idx] = svcTypeMap[item["{#SVC_TYPE}"]] || item["{#SVC_TYPE}"]; }
    // Service description
    if (item["{#SVC_DESC}"]) { svcDescs[idx] = item["{#SVC_DESC}"]; }
    // Service ID value — fallback when descriptive service name is unavailable
    if (item["{#SVC_ID_VAL}"]) { if (!services[idx]) services[idx] = item["{#SVC_ID_VAL}"]; }
    // SDP far-end IP address — keyed by sdpId
    if (item["{#SDP_IP}"]) { sdpIps[idx] = item["{#SDP_IP}"]; }

    // SDP binding entries — collected for Phase 2
    else if (item["{#SDP_STATUS}"]) { sdpEntries.push(item); }

    // Service-to-customer mapping
    if (item["{#SVC_CUST_ID}"]) { svcCustomers[idx] = item["{#SVC_CUST_ID}"]; }
    // Customer descriptions — keyed by custId
    if (item["{#CUST_DESC}"]) { customers[idx] = item["{#CUST_DESC}"]; }
});

// Phase 2: Decode each SDP binding's compound SNMP index and resolve references.
// Index format: svcId.sdpId(4).{type.}vcId(4) — minimum 9 octets; type present when length > 9
sdpEntries.forEach(function (sdp) {
    var origin = sdp["{#SDP_ORIGIN}"];
    var rawType = sdp["{#SDP_TYPE}"];
    var typeStr;

    // Determine SDP binding type from origin (sdpBindingOrigin) first;
    // fall back to raw type (sdpBindingType: 1=Spoke, 2=Mesh) for manual bindings.
    if (origin == "2") { typeStr = "BgpAd"; }
    else if (origin == "4") { typeStr = "BgpVpls"; }
    else if (origin == "9") { typeStr = "BgpVpws"; }
    else if (origin == "13") { typeStr = "EVPN"; }
    else { typeStr = (rawType == "1") ? "Spoke" : (rawType == "2") ? "Mesh" : "Unknown"; }

    var index = sdp["{#SNMPINDEX}"];
    var parts = index.split('.');

    if (parts.length >= 9) {
        var svcIdRaw = parts[0];

        // SDP ID: 4 octets (parts[1-4]) reassembled into a 32-bit unsigned integer
        var s1 = parseInt(parts[1]), s2 = parseInt(parts[2]), s3 = parseInt(parts[3]), s4 = parseInt(parts[4]);
        var sdpIdNum = ((s1 << 24) | (s2 << 16) | (s3 << 8) | s4) >>> 0;

        // VC ID: last 4 octets reassembled into a 32-bit unsigned integer
        var v1 = parseInt(parts[parts.length - 4]), v2 = parseInt(parts[parts.length - 3]),
            v3 = parseInt(parts[parts.length - 2]), v4 = parseInt(parts[parts.length - 1]);
        var vcIdNum = ((v1 << 24) | (v2 << 16) | (v3 << 8) | v4) >>> 0;

        // Resolve far-end IP using sdpId as lookup key
        var farEnd = sdpIps[sdpIdNum] || "0.0.0.0";
        var svcName = services[svcIdRaw] || svcIdRaw;

        // Resolve customer name from service-to-customer mapping
        var custId = svcCustomers[svcIdRaw] || "0";
        var custName;
        if (custId !== "0") {
            custName = customers[custId] || "Customer-" + custId;
        } else {
            custName = "";
        }

        // Build LLD entry; label matches Nokia CLI format: sdp:<id>:<vcid> (<far-end IP>)
        output.push({
            "{#SNMPINDEX}": index,
            "{#SERVICE_ID}": svcIdRaw,
            "{#SERVICE_NAME}": svcName,
            "{#SERVICE_DESC}": svcDescs[svcIdRaw] || "",
            "{#SVC_TYPE}": svcTypes[svcIdRaw] || "",
            "{#SDP_ID}": sdpIdNum.toString(),
            "{#VC_ID}": vcIdNum.toString(),
            "{#SDP_TYPE}": typeStr,
            "{#CUSTOMER_ID}": custId,
            "{#CUSTOMER}": custName,
            "{#LABEL}": "sdp:" + sdpIdNum + ":" + vcIdNum + " (" + farEnd + ") "
        });
    }
});

return JSON.stringify(output);
