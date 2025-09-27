(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DRUG-HASH u101)
(define-constant ERR-INVALID-REACTION u102)
(define-constant ERR-INVALID-SEVERITY u103)
(define-constant ERR-INVALID-TIMESTAMP u104)
(define-constant ERR-INVALID-ANON-ID u105)
(define-constant ERR-REPORT-ALREADY-EXISTS u106)
(define-constant ERR-REPORT-NOT-FOUND u107)
(define-constant ERR-INVALID-STATUS u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-SYMPTOMS u110)
(define-constant ERR-INVALID-OUTCOME u111)
(define-constant ERR-INVALID-AGE u112)
(define-constant ERR-INVALID-GENDER u113)
(define-constant ERR-INVALID-LOCATION u114)
(define-constant ERR-INVALID-DOSAGE u115)
(define-constant ERR-INVALID-DURATION u116)
(define-constant ERR-INVALID-REPORTER-HASH u117)
(define-constant ERR-MAX-REPORTS-EXCEEDED u118)
(define-constant ERR-INVALID-UPDATE-PARAM u119)
(define-constant ERR-REPORT-UPDATE-NOT-ALLOWED u120)

(define-data-var next-report-id uint u0)
(define-data-var max-reports uint u1000000)
(define-data-var submission-fee uint u10)
(define-data-var authority-contract (optional principal) none)

(define-map Reports
  uint
  {
    drug-hash: (buff 32),
    reaction: (string-ascii 256),
    severity: uint,
    timestamp: uint,
    anon-id: (buff 32),
    status: bool,
    symptoms: (string-ascii 512),
    outcome: (string-ascii 128),
    age: uint,
    gender: (string-ascii 20),
    location: (string-ascii 100),
    dosage: uint,
    duration: uint,
    reporter-hash: (buff 32)
  }
)

(define-map ReportsByDrugHash
  (buff 32)
  (list 1000 uint)
)

(define-map ReportUpdates
  uint
  {
    update-reaction: (string-ascii 256),
    update-severity: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-report (id uint))
  (map-get? Reports id)
)

(define-read-only (get-report-updates (id uint))
  (map-get? ReportUpdates id)
)

(define-read-only (get-reports-by-drug (drug-hash (buff 32)))
  (default-to (list) (map-get? ReportsByDrugHash drug-hash))
)

(define-private (validate-drug-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-DRUG-HASH))
)

(define-private (validate-reaction (desc (string-ascii 256)))
  (if (and (> (len desc) u0) (<= (len desc) u256))
      (ok true)
      (err ERR-INVALID-REACTION))
)

(define-private (validate-severity (level uint))
  (if (and (>= level u1) (<= level u5))
      (ok true)
      (err ERR-INVALID-SEVERITY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-anon-id (id (buff 32)))
  (if (is-eq (len id) u32)
      (ok true)
      (err ERR-INVALID-ANON-ID))
)

(define-private (validate-symptoms (sym (string-ascii 512)))
  (if (<= (len sym) u512)
      (ok true)
      (err ERR-INVALID-SYMPTOMS))
)

(define-private (validate-outcome (out (string-ascii 128)))
  (if (<= (len out) u128)
      (ok true)
      (err ERR-INVALID-OUTCOME))
)

(define-private (validate-age (a uint))
  (if (and (>= a u0) (<= a u120))
      (ok true)
      (err ERR-INVALID-AGE))
)

(define-private (validate-gender (g (string-ascii 20)))
  (if (<= (len g) u20)
      (ok true)
      (err ERR-INVALID-GENDER))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (<= (len loc) u100)
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-dosage (d uint))
  (if (> d u0)
      (ok true)
      (err ERR-INVALID-DOSAGE))
)

(define-private (validate-duration (dur uint))
  (if (> dur u0)
      (ok true)
      (err ERR-INVALID-DURATION))
)

(define-private (validate-reporter-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-REPORTER-HASH))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-reports (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-REPORTS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-reports new-max)
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (submit-report
  (drug-hash (buff 32))
  (reaction (string-ascii 256))
  (severity uint)
  (anon-id (buff 32))
  (symptoms (string-ascii 512))
  (outcome (string-ascii 128))
  (age uint)
  (gender (string-ascii 20))
  (location (string-ascii 100))
  (dosage uint)
  (duration uint)
  (reporter-hash (buff 32))
)
  (let (
        (next-id (var-get next-report-id))
        (current-max (var-get max-reports))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-REPORTS-EXCEEDED))
    (try! (validate-drug-hash drug-hash))
    (try! (validate-reaction reaction))
    (try! (validate-severity severity))
    (try! (validate-anon-id anon-id))
    (try! (validate-symptoms symptoms))
    (try! (validate-outcome outcome))
    (try! (validate-age age))
    (try! (validate-gender gender))
    (try! (validate-location location))
    (try! (validate-dosage dosage))
    (try! (validate-duration duration))
    (try! (validate-reporter-hash reporter-hash))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get submission-fee) tx-sender authority-recipient))
    )
    (map-set Reports next-id
      {
        drug-hash: drug-hash,
        reaction: reaction,
        severity: severity,
        timestamp: block-height,
        anon-id: anon-id,
        status: true,
        symptoms: symptoms,
        outcome: outcome,
        age: age,
        gender: gender,
        location: location,
        dosage: dosage,
        duration: duration,
        reporter-hash: reporter-hash
      }
    )
    (map-set ReportsByDrugHash drug-hash
      (unwrap! (as-max-len? (append (get-reports-by-drug drug-hash) next-id) u1000) (err ERR-MAX-REPORTS-EXCEEDED))
    )
    (var-set next-report-id (+ next-id u1))
    (print { event: "report-submitted", id: next-id })
    (ok next-id)
  )
)

(define-public (update-report
  (report-id uint)
  (update-reaction (string-ascii 256))
  (update-severity uint)
)
  (let ((report (map-get? Reports report-id)))
    (match report
      r
        (begin
          (asserts! (is-eq (fold sha256 (get reporter-hash r) 0x) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-reaction update-reaction))
          (try! (validate-severity update-severity))
          (map-set Reports report-id
            (merge r
              {
                reaction: update-reaction,
                severity: update-severity,
                timestamp: block-height
              }
            )
          )
          (map-set ReportUpdates report-id
            {
              update-reaction: update-reaction,
              update-severity: update-severity,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "report-updated", id: report-id })
          (ok true)
        )
      (err ERR-REPORT-NOT-FOUND)
    )
  )
)

(define-public (get-report-count)
  (ok (var-get next-report-id))
)