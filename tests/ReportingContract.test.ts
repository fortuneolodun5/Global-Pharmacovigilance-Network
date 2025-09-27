import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DRUG_HASH = 101;
const ERR_INVALID_REACTION = 102;
const ERR_INVALID_SEVERITY = 103;
const ERR_INVALID_ANON_ID = 105;
const ERR_MAX_REPORTS_EXCEEDED = 118;
const ERR_INVALID_UPDATE_PARAM = 119;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_SYMPTOMS = 110;
const ERR_INVALID_OUTCOME = 111;
const ERR_INVALID_AGE = 112;
const ERR_INVALID_GENDER = 113;
const ERR_INVALID_LOCATION = 114;
const ERR_INVALID_DOSAGE = 115;
const ERR_INVALID_DURATION = 116;
const ERR_INVALID_REPORTER_HASH = 117;
const ERR_REPORT_NOT_FOUND = 107;

interface Report {
  drugHash: Uint8Array;
  reaction: string;
  severity: number;
  timestamp: number;
  anonId: Uint8Array;
  status: boolean;
  symptoms: string;
  outcome: string;
  age: number;
  gender: string;
  location: string;
  dosage: number;
  duration: number;
  reporterHash: Uint8Array;
}

interface ReportUpdate {
  updateReaction: string;
  updateSeverity: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ReportingContractMock {
  state: {
    nextReportId: number;
    maxReports: number;
    submissionFee: number;
    authorityContract: string | null;
    reports: Map<number, Report>;
    reportUpdates: Map<number, ReportUpdate>;
    reportsByDrugHash: Map<string, number[]>;
  } = {
    nextReportId: 0,
    maxReports: 1000000,
    submissionFee: 10,
    authorityContract: null,
    reports: new Map(),
    reportUpdates: new Map(),
    reportsByDrugHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextReportId: 0,
      maxReports: 1000000,
      submissionFee: 10,
      authorityContract: null,
      reports: new Map(),
      reportUpdates: new Map(),
      reportsByDrugHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  submitReport(
    drugHash: Uint8Array,
    reaction: string,
    severity: number,
    anonId: Uint8Array,
    symptoms: string,
    outcome: string,
    age: number,
    gender: string,
    location: string,
    dosage: number,
    duration: number,
    reporterHash: Uint8Array
  ): Result<number> {
    if (this.state.nextReportId >= this.state.maxReports) return { ok: false, value: ERR_MAX_REPORTS_EXCEEDED };
    if (drugHash.length !== 32) return { ok: false, value: ERR_INVALID_DRUG_HASH };
    if (!reaction || reaction.length > 256) return { ok: false, value: ERR_INVALID_REACTION };
    if (severity < 1 || severity > 5) return { ok: false, value: ERR_INVALID_SEVERITY };
    if (anonId.length !== 32) return { ok: false, value: ERR_INVALID_ANON_ID };
    if (symptoms.length > 512) return { ok: false, value: ERR_INVALID_SYMPTOMS };
    if (outcome.length > 128) return { ok: false, value: ERR_INVALID_OUTCOME };
    if (age < 0 || age > 120) return { ok: false, value: ERR_INVALID_AGE };
    if (gender.length > 20) return { ok: false, value: ERR_INVALID_GENDER };
    if (location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (dosage <= 0) return { ok: false, value: ERR_INVALID_DOSAGE };
    if (duration <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (reporterHash.length !== 32) return { ok: false, value: ERR_INVALID_REPORTER_HASH };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextReportId;
    const report: Report = {
      drugHash,
      reaction,
      severity,
      timestamp: this.blockHeight,
      anonId,
      status: true,
      symptoms,
      outcome,
      age,
      gender,
      location,
      dosage,
      duration,
      reporterHash,
    };
    this.state.reports.set(id, report);
    const drugKey = Buffer.from(drugHash).toString("hex");
    const existing = this.state.reportsByDrugHash.get(drugKey) || [];
    if (existing.length >= 1000) return { ok: false, value: ERR_MAX_REPORTS_EXCEEDED };
    existing.push(id);
    this.state.reportsByDrugHash.set(drugKey, existing);
    this.state.nextReportId++;
    return { ok: true, value: id };
  }

  getReport(id: number): Report | null {
    return this.state.reports.get(id) || null;
  }

  updateReport(id: number, updateReaction: string, updateSeverity: number): Result<boolean> {
    const report = this.state.reports.get(id);
    if (!report) return { ok: false, value: false };
    if (!updateReaction || updateReaction.length > 256) return { ok: false, value: false };
    if (updateSeverity < 1 || updateSeverity > 5) return { ok: false, value: false };

    const updated: Report = {
      ...report,
      reaction: updateReaction,
      severity: updateSeverity,
      timestamp: this.blockHeight,
    };
    this.state.reports.set(id, updated);
    this.state.reportUpdates.set(id, {
      updateReaction,
      updateSeverity,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getReportCount(): Result<number> {
    return { ok: true, value: this.state.nextReportId };
  }
}

describe("ReportingContract", () => {
  let contract: ReportingContractMock;

  beforeEach(() => {
    contract = new ReportingContractMock();
    contract.reset();
  });

  it("submits a report successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const drugHash = new Uint8Array(32).fill(1);
    const anonId = new Uint8Array(32).fill(2);
    const reporterHash = new Uint8Array(32).fill(3);
    const result = contract.submitReport(
      drugHash,
      "Headache",
      3,
      anonId,
      "Nausea, Vomiting",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const report = contract.getReport(0);
    expect(report?.reaction).toBe("Headache");
    expect(report?.severity).toBe(3);
    expect(report?.symptoms).toBe("Nausea, Vomiting");
    expect(report?.outcome).toBe("Recovered");
    expect(report?.age).toBe(45);
    expect(report?.gender).toBe("Male");
    expect(report?.location).toBe("USA");
    expect(report?.dosage).toBe(100);
    expect(report?.duration).toBe(7);
    expect(contract.stxTransfers).toEqual([{ amount: 10, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects invalid drug hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const invalidHash = new Uint8Array(31).fill(1);
    const anonId = new Uint8Array(32).fill(2);
    const reporterHash = new Uint8Array(32).fill(3);
    const result = contract.submitReport(
      invalidHash,
      "Headache",
      3,
      anonId,
      "Nausea",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DRUG_HASH);
  });

  it("rejects submission without authority contract", () => {
    const drugHash = new Uint8Array(32).fill(1);
    const anonId = new Uint8Array(32).fill(2);
    const reporterHash = new Uint8Array(32).fill(3);
    const result = contract.submitReport(
      drugHash,
      "Headache",
      3,
      anonId,
      "Nausea",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid severity", () => {
    contract.setAuthorityContract("ST2TEST");
    const drugHash = new Uint8Array(32).fill(1);
    const anonId = new Uint8Array(32).fill(2);
    const reporterHash = new Uint8Array(32).fill(3);
    const result = contract.submitReport(
      drugHash,
      "Headache",
      6,
      anonId,
      "Nausea",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SEVERITY);
  });

  it("updates a report successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const drugHash = new Uint8Array(32).fill(1);
    const anonId = new Uint8Array(32).fill(2);
    const reporterHash = new Uint8Array(32).fill(3);
    contract.submitReport(
      drugHash,
      "Headache",
      3,
      anonId,
      "Nausea",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash
    );
    const result = contract.updateReport(0, "Severe Headache", 4);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const report = contract.getReport(0);
    expect(report?.reaction).toBe("Severe Headache");
    expect(report?.severity).toBe(4);
    const update = contract.state.reportUpdates.get(0);
    expect(update?.updateReaction).toBe("Severe Headache");
    expect(update?.updateSeverity).toBe(4);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent report", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateReport(99, "New Reaction", 4);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets submission fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setSubmissionFee(20);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(20);
    const drugHash = new Uint8Array(32).fill(1);
    const anonId = new Uint8Array(32).fill(2);
    const reporterHash = new Uint8Array(32).fill(3);
    contract.submitReport(
      drugHash,
      "Headache",
      3,
      anonId,
      "Nausea",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash
    );
    expect(contract.stxTransfers).toEqual([{ amount: 20, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects submission fee change without authority", () => {
    const result = contract.setSubmissionFee(20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct report count", () => {
    contract.setAuthorityContract("ST2TEST");
    const drugHash1 = new Uint8Array(32).fill(1);
    const anonId1 = new Uint8Array(32).fill(2);
    const reporterHash1 = new Uint8Array(32).fill(3);
    contract.submitReport(
      drugHash1,
      "Headache",
      3,
      anonId1,
      "Nausea",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash1
    );
    const drugHash2 = new Uint8Array(32).fill(4);
    const anonId2 = new Uint8Array(32).fill(5);
    const reporterHash2 = new Uint8Array(32).fill(6);
    contract.submitReport(
      drugHash2,
      "Dizziness",
      2,
      anonId2,
      "Fatigue",
      "Ongoing",
      30,
      "Female",
      "EU",
      50,
      14,
      reporterHash2
    );
    const result = contract.getReportCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("rejects report submission with max reports exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxReports = 1;
    const drugHash1 = new Uint8Array(32).fill(1);
    const anonId1 = new Uint8Array(32).fill(2);
    const reporterHash1 = new Uint8Array(32).fill(3);
    contract.submitReport(
      drugHash1,
      "Headache",
      3,
      anonId1,
      "Nausea",
      "Recovered",
      45,
      "Male",
      "USA",
      100,
      7,
      reporterHash1
    );
    const drugHash2 = new Uint8Array(32).fill(4);
    const anonId2 = new Uint8Array(32).fill(5);
    const reporterHash2 = new Uint8Array(32).fill(6);
    const result = contract.submitReport(
      drugHash2,
      "Dizziness",
      2,
      anonId2,
      "Fatigue",
      "Ongoing",
      30,
      "Female",
      "EU",
      50,
      14,
      reporterHash2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_REPORTS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});