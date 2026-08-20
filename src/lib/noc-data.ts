import type { Device, Incident, KnowledgeEntry } from "./noc-types";

export const devices: Device[] = [
  {
    hostname: "sw-lab-core-01",
    vendor: "cisco_xe",
    host: "10.20.0.11",
    site: "Chennai — DC1",
    topology: "Core switch, uplink to rtr-lab-edge-01 via Po1",
    circuit: "N/A (internal fabric)",
    ispContact: "n/a",
  },
  {
    hostname: "sw-lab-access-04",
    vendor: "cisco_xe",
    host: "10.20.4.14",
    site: "Chennai — Floor 4",
    topology: "Access switch, uplink Gi0/48 to sw-lab-core-01",
    circuit: "N/A (internal fabric)",
    ispContact: "n/a",
  },
  {
    hostname: "rtr-lab-edge-01",
    vendor: "cisco_xe",
    host: "10.20.0.2",
    site: "Chennai — DC1",
    topology: "WAN edge, dual ISP (primary Airtel, backup Tata)",
    circuit: "AIR-CHN-88412",
    ispContact: "noc@airtel-ent.example — 1800-000-111",
  },
  {
    hostname: "fw-lab-perim-01",
    vendor: "fortinet",
    host: "10.20.0.30",
    site: "Chennai — DC1",
    topology: "Perimeter firewall, HA pair with fw-lab-perim-02",
    circuit: "AIR-CHN-88412",
    ispContact: "noc@airtel-ent.example — 1800-000-111",
  },
  {
    hostname: "sw-blr-access-02",
    vendor: "cisco_xe",
    host: "10.30.2.12",
    site: "Bengaluru — Whitefield",
    topology: "Access switch, uplink Gi0/24 to sw-blr-core-01",
    circuit: "TAT-BLR-31207",
    ispContact: "support@tatacomm-ent.example",
  },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const seedIncidents: Incident[] = [
  {
    id: "INC-2041",
    receivedAt: minsAgo(4),
    severity: "critical",
    status: "new",
    hostname: "sw-lab-core-01",
    interfaceName: "GigabitEthernet0/1",
    category: "port-down",
    rawAlert: "CRIT: gi0/1 down on sw-lab-core-01 (link state changed to down)",
    summary: "Access uplink Gi0/1 is down on the core switch.",
    diagnosis:
      "Interface Gi0/1 is administratively up but the line protocol is down, with no transceiver light detected. Pattern matches the port-down runbook: physical link or SFP failure rather than a config change (running-config unchanged for 34 days).",
    runbook: "port-down.md",
    matchConfidence: 0.94,
    diagnostics: [
      {
        command: "show interface GigabitEthernet0/1 status",
        output:
          "Port      Name         Status    Vlan   Duplex  Speed Type\nGi0/1     uplink-acc04 notconnect  110   auto    auto  1000BaseSX SFP",
        durationMs: 812,
      },
      {
        command: "show interface GigabitEthernet0/1 | include error|drops",
        output:
          "     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n     Input queue: 0/75/0/0 (size/max/drops/flushes)",
        durationMs: 640,
      },
      {
        command: "show logging | include Gi0/1",
        output:
          "*Aug 20 14:02:11: %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down\n*Aug 20 14:02:12: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down",
        durationMs: 703,
      },
    ],
    recommendedActions: [
      "Verify the SFP and patch lead at both ends (sw-lab-core-01 Gi0/1 ↔ sw-lab-access-04 Gi0/48).",
      "Bounce the interface once to rule out a soft link fault.",
      "If the port stays down after a bounce, dispatch smart hands for SFP replacement.",
    ],
    remediation: [
      { description: "Shut the interface", command: "interface Gi0/1 ; shutdown" },
      { description: "Wait 5 seconds, then re-enable", command: "interface Gi0/1 ; no shutdown" },
      { description: "Re-verify link state", command: "show interface Gi0/1 status" },
    ],
    source: "sample",
  },
  {
    id: "INC-2040",
    receivedAt: minsAgo(23),
    severity: "major",
    status: "triaged",
    hostname: "sw-lab-access-04",
    interfaceName: "GigabitEthernet0/12",
    category: "interface-errors",
    rawAlert: "MAJOR: rising CRC errors on gi0/12 (sw-lab-access-04) — 4,812 in 5m",
    summary: "CRC error rate climbing on an access port serving the lab test bench.",
    diagnosis:
      "Input errors are almost entirely CRC with no matching output errors, which points to a cabling or duplex mismatch on the far end rather than a switch fault. Error rate rose after the port renegotiated to 100/half.",
    runbook: "interface-errors.md",
    matchConfidence: 0.88,
    diagnostics: [
      {
        command: "show interface GigabitEthernet0/12 | include errors|duplex",
        output:
          "  Half-duplex, 100Mb/s, media type is 10/100/1000BaseTX\n     4812 input errors, 4809 CRC, 3 frame, 0 overrun, 0 ignored\n     0 output errors, 0 collisions, 0 interface resets",
        durationMs: 587,
      },
      {
        command: "show interface GigabitEthernet0/12 counters errors",
        output:
          "Port       Align-Err  FCS-Err  Xmit-Err  Rcv-Err  UnderSize  OutDiscards\nGi0/12             0     4809         0     4812          0            0",
        durationMs: 512,
      },
    ],
    recommendedActions: [
      "Replace the patch cable to the bench host and reseat both ends.",
      "Hard-set speed/duplex to 1000/full on both sides if the host NIC supports it.",
      "Clear counters and re-check after 15 minutes.",
    ],
    remediation: [
      { description: "Clear interface counters", command: "clear counters Gi0/12" },
      {
        description: "Pin speed and duplex",
        command: "interface Gi0/12 ; speed 1000 ; duplex full",
      },
    ],
    source: "sample",
  },
  {
    id: "INC-2039",
    receivedAt: hoursAgo(2),
    severity: "major",
    status: "healing",
    hostname: "rtr-lab-edge-01",
    category: "high-latency",
    rawAlert: "MAJOR: RTT to 8.8.8.8 via AIR-CHN-88412 = 412ms avg over 5m (baseline 18ms)",
    summary: "WAN latency on the primary ISP circuit is 22x baseline.",
    diagnosis:
      "Latency and jitter are elevated only on the Airtel primary path; the Tata backup path is normal. Egress queue drops on Gi0/0/0 indicate the circuit is saturated rather than an ISP core issue. Matches the high-latency runbook, congestion branch.",
    runbook: "high-latency.md",
    matchConfidence: 0.81,
    diagnostics: [
      {
        command: "ping 8.8.8.8 source Gi0/0/0 repeat 20",
        output:
          "Success rate is 100 percent (20/20), round-trip min/avg/max = 288/412/705 ms",
        durationMs: 21400,
      },
      {
        command: "show interface Gi0/0/0 | include rate|drops",
        output:
          "  5 minute input rate 186,224,000 bits/sec\n  5 minute output rate 197,880,000 bits/sec\n     Output queue: 64/64 (size/max), 18422 drops",
        durationMs: 640,
      },
      {
        command: "show ip route 8.8.8.8",
        output: "Known via \"bgp 65010\", distance 20, metric 0\n  * 203.0.113.1, from 203.0.113.1, via GigabitEthernet0/0/0",
        durationMs: 430,
      },
    ],
    recommendedActions: [
      "Shift bulk backup traffic to the Tata backup path for the maintenance window.",
      "Open a ticket with Airtel quoting circuit AIR-CHN-88412 and the drop counters.",
      "Confirm QoS policy is applied on the egress interface.",
    ],
    remediation: [
      {
        description: "Prefer backup path for bulk class",
        command: "route-map WAN-BULK permit 10 ; set ip next-hop 198.51.100.1",
      },
    ],
    healLog: [
      "14:05:02  Matched runbook high-latency.md (confidence 0.81)",
      "14:05:04  Opened SSH session to 10.20.0.2 (read-only account)",
      "14:05:26  Collected 3 diagnostic outputs",
      "14:05:27  Auto-heal policy: bulk-class reroute requires approval — awaiting operator",
    ],
    source: "sample",
  },
  {
    id: "INC-2038",
    receivedAt: hoursAgo(5),
    severity: "minor",
    status: "resolved",
    hostname: "fw-lab-perim-01",
    category: "ha-sync",
    rawAlert: "MINOR: HA sync delayed on fw-lab-perim-01 (peer out of sync 92s)",
    summary: "Firewall HA pair briefly fell out of sync during a config push.",
    diagnosis:
      "Session-sync lag followed a policy install; the pair reconverged on its own within two minutes. No failover occurred and no traffic was impacted.",
    runbook: "fortigate-ha.md",
    matchConfidence: 0.76,
    diagnostics: [
      {
        command: "get system ha status",
        output:
          "HA Health Status: OK\nModel: FortiGate-100F\nMode: HA A-P\nsync: in-sync (last delta 0s)",
        durationMs: 910,
      },
    ],
    recommendedActions: [
      "No action required — monitor for recurrence during the next policy push.",
    ],
    healedAt: hoursAgo(4.8),
    healLog: [
      "09:41:10  Matched runbook fortigate-ha.md (confidence 0.76)",
      "09:41:38  Verified HA status — pair reconverged",
      "09:41:39  Auto-resolved, no operator action needed",
    ],
    source: "sample",
  },
  {
    id: "INC-2037",
    receivedAt: hoursAgo(9),
    severity: "critical",
    status: "resolved",
    hostname: "sw-blr-access-02",
    interfaceName: "GigabitEthernet0/24",
    category: "port-down",
    rawAlert: "CRIT: uplink gi0/24 down on sw-blr-access-02",
    summary: "Bengaluru access switch lost its uplink; auto-healed by interface bounce.",
    diagnosis:
      "Link stuck in err-disabled after a storm-control trigger. Auto-heal cleared the err-disable state and the port recovered on the first bounce.",
    runbook: "port-down.md",
    matchConfidence: 0.91,
    diagnostics: [
      {
        command: "show interface status err-disabled",
        output: "Port      Name      Status            Reason\nGi0/24    uplink    err-disabled      storm-control",
        durationMs: 620,
      },
    ],
    recommendedActions: ["Review storm-control thresholds on the access layer."],
    remediation: [
      { description: "Clear err-disable", command: "interface Gi0/24 ; shutdown ; no shutdown" },
    ],
    healedAt: hoursAgo(8.9),
    healLog: [
      "05:52:03  Matched runbook port-down.md (confidence 0.91)",
      "05:52:11  Auto-heal enabled for category port-down",
      "05:52:19  Executed: interface Gi0/24 ; shutdown ; no shutdown",
      "05:52:31  Verified: Gi0/24 connected, line protocol up",
      "05:52:31  Incident auto-resolved in 28s",
    ],
    source: "sample",
  },
  {
    id: "INC-2036",
    receivedAt: hoursAgo(14),
    severity: "info",
    status: "resolved",
    hostname: "sw-lab-core-01",
    category: "config-change",
    rawAlert: "INFO: running-config changed on sw-lab-core-01 by user netops",
    summary: "Tracked configuration change on the core switch.",
    diagnosis: "Change matched an approved change window; diff limited to SNMP community rotation.",
    runbook: "config-change.md",
    matchConfidence: 0.69,
    diagnostics: [
      {
        command: "show archive config differences",
        output: "-snmp-server community old-ro RO\n+snmp-server community new-ro RO",
        durationMs: 1100,
      },
    ],
    recommendedActions: ["Logged for audit — no action."],
    healedAt: hoursAgo(13.9),
    source: "sample",
  },
];

export const seedKnowledge: KnowledgeEntry[] = [
  {
    id: "KB-001",
    title: "Port down — physical link or SFP failure",
    category: "port-down",
    vendor: "cisco_xe",
    symptoms: ["link state changed to down", "notconnect", "err-disabled", "gi0/ down"],
    rootCause:
      "Line protocol down with no config change. Usually a failed SFP, unseated patch lead, or an err-disable trigger such as storm-control or BPDU guard.",
    remediation: [
      { description: "Check err-disable reason", command: "show interface status err-disabled" },
      { description: "Bounce the port", command: "interface {{intf}} ; shutdown ; no shutdown" },
      { description: "Verify recovery", command: "show interface {{intf}} status" },
    ],
    autoHeal: true,
    origin: "builtin",
    createdAt: hoursAgo(720),
  },
  {
    id: "KB-002",
    title: "Rising interface errors — CRC / duplex mismatch",
    category: "interface-errors",
    vendor: "cisco_xe",
    symptoms: ["CRC errors", "input errors", "half-duplex", "FCS-Err"],
    rootCause:
      "CRC-heavy input errors with clean output counters indicate bad cabling or a speed/duplex mismatch with the attached host.",
    remediation: [
      { description: "Clear counters for a clean baseline", command: "clear counters {{intf}}" },
      { description: "Pin speed and duplex", command: "interface {{intf}} ; speed 1000 ; duplex full" },
    ],
    autoHeal: false,
    origin: "builtin",
    createdAt: hoursAgo(700),
  },
  {
    id: "KB-003",
    title: "High WAN latency — circuit congestion",
    category: "high-latency",
    vendor: "cisco_xe",
    symptoms: ["RTT", "latency", "jitter", "output queue drops"],
    rootCause:
      "Latency isolated to one ISP path with egress queue drops means the circuit is saturated. If drops are absent, escalate to the ISP as a transit problem.",
    remediation: [
      { description: "Confirm egress drops", command: "show interface {{wan}} | include rate|drops" },
      { description: "Verify QoS policy is attached", command: "show policy-map interface {{wan}}" },
    ],
    autoHeal: false,
    origin: "builtin",
    createdAt: hoursAgo(680),
  },
  {
    id: "KB-004",
    title: "FortiGate HA out of sync",
    category: "ha-sync",
    vendor: "fortinet",
    symptoms: ["HA sync", "out of sync", "peer"],
    rootCause:
      "Session-sync lag after a policy install. Self-clears within ~2 minutes; a persistent out-of-sync state means a version or config mismatch between peers.",
    remediation: [
      { description: "Check HA status", command: "get system ha status" },
      { description: "Compare checksums", command: "diagnose sys ha checksum show" },
    ],
    autoHeal: true,
    origin: "builtin",
    createdAt: hoursAgo(600),
  },
];

export const deviceByHostname = (hostname: string) =>
  devices.find((d) => d.hostname === hostname);
