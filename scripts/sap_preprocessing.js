// Zabbix LLD preprocessor for SAP (Service Access Point) discovery on Nokia SR-OS.
// Correlates port names, service IDs, encapsulation values, and customer info
// from separate SNMP walks (TIMETRA-SERV-MIB) into a single discovery array.

var input = JSON.parse(value);
// Service type value mapping (TmnxServType from TIMETRA-SERV-MIB)
var svcTypeMap = {"0":"unknown","1":"epipe","3":"vpls","4":"vprn","5":"ies","6":"mirror","7":"apipe","8":"fpipe","9":"ipipe","10":"cpipe","11":"intTls","12":"evpnIsaTls"};
var ports = {};
var services = {};
var svcNames = {};
var svcDescs = {};
var sapData = {};
var customers = {};
var svcTypes = {};
var hasSaps = false;

// Phase 1: Build lookup tables from the flat SNMP discovery results.
// Each item carries only one useful field; we sort them into maps keyed by SNMP index.
input.forEach(function (item) {
    var idx = item["{#SNMPINDEX}"];

    // Port names (IF-MIB ifName) — keyed by ifIndex
    if (item["{#PORT_NAME}"]) {
        ports[idx] = item["{#PORT_NAME}"];
    }
    // Service type — map numeric value to name (TmnxServType)
    if (item["{#SVC_TYPE}"]) {
        svcTypes[idx] = svcTypeMap[item["{#SVC_TYPE}"]] || item["{#SVC_TYPE}"];
    }
    // Service name — keyed by svcId
    if (item["{#SVC_NAME}"]) {
        svcNames[idx] = item["{#SVC_NAME}"];
    }
    // Service description — keyed by svcId
    if (item["{#SVC_DESC}"]) {
        svcDescs[idx] = item["{#SVC_DESC}"];
    }
    // Service IDs — keyed by svcId
    if (item["{#SVC_ID_VAL}"]) {
        services[idx] = item["{#SVC_ID_VAL}"];
    }
    // SAP entries — keyed by compound index (svcId.portId.encap)
    else if (item["{#SAP_PORT_ID}"]) {
        hasSaps = true;
        if (!sapData[idx]) { sapData[idx] = {}; }
        sapData[idx].portId = item["{#SAP_PORT_ID}"];
    }
    // Customer descriptions — keyed by custId
    if (item["{#CUST_DESC}"]) {
        customers[idx] = item["{#CUST_DESC}"];
    }
    // SAP customer ID — stored alongside SAP entry
    if (item["{#SAP_CUST_ID}"]) {
        if (!sapData[idx]) { sapData[idx] = {}; }
        sapData[idx].custId = item["{#SAP_CUST_ID}"];
    }
    // SAP encapsulation value (VLAN tag)
    if (item["{#ENCAP_VAL}"]) {
        if (!sapData[idx]) { sapData[idx] = {}; }
        sapData[idx].encap = item["{#ENCAP_VAL}"];
    }
});

// If no SAPs were found in the SNMP walk, return an empty array immediately
if (!hasSaps) return JSON.stringify([]);

// Phase 2: Resolve references and build the final LLD output.
// For each SAP, look up its port name, service ID, and customer name from the maps above.
var output = [];
for (var snmpIndex in sapData) {
    var entry = sapData[snmpIndex];
    if (!entry.portId) continue;

    // The first octet of the compound SAP index is the service ID
    var svcIndex = snmpIndex.split('.')[0];

    var custId = entry.custId || "0";

    // Resolve customer name; leave blank if no customer is assigned (custId 0)
    var custName;
    if (custId !== "0") {
        custName = customers[custId] || "Customer-" + custId;
    } else {
        custName = "";
    }

    // Build LLD entry; resolve port name and service ID from lookup tables
    output.push({
        "{#SNMPINDEX}": snmpIndex,
        "{#PORT_NAME}": ports[entry.portId] || "Port-" + entry.portId,
        "{#SERVICE_ID}": services[svcIndex] || svcIndex,
        "{#SERVICE_NAME}": svcNames[svcIndex] || services[svcIndex] || svcIndex,
        "{#SERVICE_DESC}": svcDescs[svcIndex] || "",
        "{#SVC_TYPE}": svcTypes[svcIndex] || "",
        "{#ENCAP}": entry.encap || "0",
        "{#CUSTOMER_ID}": custId,
        "{#CUSTOMER}": custName
    });
}

return JSON.stringify(output);
