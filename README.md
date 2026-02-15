# Alcatel Timetra TiMOS Services by SNMP

Zabbix template for discovering and monitoring MPLS services (SAP and SDP bindings) on Nokia/Alcatel SR-OS routers via SNMP.

- **Zabbix export version:** 7.4
- **Vendor:** HGCNetworks (v1.0-2)
- **MIBs:** TIMETRA-SERV-MIB, IF-MIB

## Requirements

- Zabbix >= 7.4
- SNMP v2c or v3 access to Nokia SR-OS (TiMOS) devices

## Discovery rules

### SAP discovery

**Key:** `services-sap.discovery` | **Interval:** 1h

Discovers Service Access Points by walking 7 OIDs (sapPortId, ifName, svcId, svcType, encapVal, sapCustId, custDesc). A JavaScript preprocessing step correlates the flat SNMP results into LLD entries.

**LLD macros:** `{#SNMPINDEX}`, `{#PORT_NAME}`, `{#SERVICE_ID}`, `{#SVC_TYPE}`, `{#ENCAP}`, `{#CUSTOMER_ID}`, `{#CUSTOMER}`

**Item prototypes (13):**

| Item | Type | Units |
|------|------|-------|
| Sap operational status | SNMP | valuemap |
| inProfile ingress octets | SNMP | bps |
| inProfile egress octets | SNMP | bps |
| outofProfile ingress octets | SNMP | bps |
| outofProfile egress octets | SNMP | bps |
| IngressQchip inProfile packets | SNMP | pps |
| IngressQchip outOfProfile packets | SNMP | pps |
| EgressQchip inProfile packets | SNMP | pps |
| EgressQchip outOfProfile packets | SNMP | pps |
| Total ingress octets | Calculated | bps |
| Total egress octets | Calculated | bps |
| Total ingress packets | Calculated | pps |
| Total egress packets | Calculated | pps |

**Triggers:** HIGH alert on SAP operStatus change to non-up, auto-recovers when status returns to up.

**Graphs (4):** Traffic summary, traffic detail (in/out-of-profile), packets summary, packets detail.

### SDP Binding discovery

**Key:** `service-sdpBind.discovery` | **Interval:** 1h

Discovers MPLS SDP bindings by walking 10 OIDs (svcIdVal, svcName, svcType, sdpIdVal, sdpStatus, sdpType, sdpIp, svcCustId, custDesc, sdpOrigin). A JavaScript preprocessing step decodes the compound SNMP index to extract 32-bit SDP IDs and VC IDs, resolves far-end IP addresses, and classifies binding types.

**Binding types:** Spoke, Mesh, BgpAd, BgpVpls, BgpVpws, EVPN

**LLD macros:** `{#SNMPINDEX}`, `{#SERVICE_ID}`, `{#SERVICE_NAME}`, `{#SVC_TYPE}`, `{#SDP_ID}`, `{#VC_ID}`, `{#SDP_TYPE}`, `{#CUSTOMER_ID}`, `{#CUSTOMER}`, `{#LABEL}`

**Item prototypes (3):**

| Item | Type | Units |
|------|------|-------|
| SDP operStatus | SNMP | valuemap |
| Ingress forwarded octets | SNMP | bps |
| Egress forwarded octets | SNMP | bps |

**Triggers:** HIGH alert on SDP operStatus change to non-up, auto-recovers when status returns to up.

**Graphs (1):** SDP traffic (ingress/egress).

## Value maps

| Name | Description |
|------|-------------|
| sapOperStatus | up, down, ingressQosMismatch, egressQosMismatch, portMtuTooSmall, svcAdminDown, iesIfAdminDown |
| sdpBindOperStatus | up, noEgressLabel, noIngressLabel, noLabels, down, svcMtuMismatch, sdpPathMtuTooSmall, sdpNotReady, sdpDown, sapDown |

## Installation

1. Import `zbx_template_Alcatel_Timetra_TiMOS_Services.yaml` via the Zabbix UI: **Data collection > Templates > Import**.
2. Link the template to your Nokia SR-OS hosts that have SNMP configured.

## Standalone JS files

`sap_preprocessing.js` and `sdp_preprocessing.js` are identical to the JavaScript embedded in the template's discovery rule preprocessing steps. They are kept as standalone files for easier editing, diffing, and testing outside of Zabbix.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
