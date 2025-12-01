/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(["N/record", "N/search", "N/log", "N/runtime"],
    (record, search, log, runtime) => {

        const execute = () => {
            try {
                // Search all Journal Entries (mainline only)
                const journalSearch = search.create({
                    type: search.Type.JOURNAL_ENTRY,
                    filters: [["mainline", "is", "T"]],
                    columns: [
                        search.createColumn({ name: "internalid", summary: search.Summary.GROUP }),
                        search.createColumn({ name: "tranid", summary: search.Summary.GROUP, sort: search.Sort.ASC }),
                        search.createColumn({ name: "advintercompany", summary: search.Summary.GROUP }), // detect AIJ
                    ],
                });

                const pagedData = journalSearch.runPaged({ pageSize: 1000 });
                let subsidiaryCounters = {}; // { subsidiaryId: { prefix, counter } }

                pagedData.pageRanges.forEach((pageRange) => {
                    const page = pagedData.fetch({ index: pageRange.index });

                    page.data.forEach((result) => {
                        const internalId = result.getValue({ name: "internalid", summary: search.Summary.GROUP });
                        const oldTranId = result.getValue({ name: "tranid", summary: search.Summary.GROUP });
                        const isAdvInterco = result.getValue({ name: "advintercompany", summary: search.Summary.GROUP }) === "T";
                        log.debug("isAdvInterco", isAdvInterco);

                        try {
                            // Choose correct record type
                            const recType = isAdvInterco
                                ? record.Type.ADV_INTER_COMPANY_JOURNAL_ENTRY
                                : record.Type.JOURNAL_ENTRY;

                            // Load record to get subsidiary
                            const journalRec = record.load({ type: recType, id: internalId });
                            const subsidiaryId = journalRec.getValue("subsidiary");
                            if (!subsidiaryId) {
                                log.debug("Skip", `Record ${internalId} has no subsidiary`);
                                return true;
                            }

                            // Load subsidiary prefix once per subsidiary
                            let tranPrefix = "";
                            if (!subsidiaryCounters[subsidiaryId]) {
                                try {
                                    const subsidiaryRec = record.load({
                                        type: record.Type.SUBSIDIARY,
                                        id: subsidiaryId
                                    });
                                    tranPrefix = subsidiaryRec.getValue("tranprefix") || "";
                                    subsidiaryCounters[subsidiaryId] = { prefix: tranPrefix, counter: 1 };
                                } catch (subErr) {
                                    log.error("Subsidiary Load Error", `Subsidiary ${subsidiaryId}: ${subErr.message}`);
                                    return true;
                                }
                            } else {
                                tranPrefix = subsidiaryCounters[subsidiaryId].prefix;
                                subsidiaryCounters[subsidiaryId].counter++;
                            }

                            // Build new tranid
                            const seqNum = subsidiaryCounters[subsidiaryId].counter;
                            const paddedNum = seqNum.toString().padStart(5, "0");
                            const newTranId = `JNL/${tranPrefix}${paddedNum}`;

                            // Update record
                            record.submitFields({
                                type: recType,
                                id: internalId,
                                values: { tranid: newTranId },
                                options: { enableSourcing: false, ignoreMandatoryFields: true },
                            });

                            log.debug(
                                "Updated",
                                `${isAdvInterco ? "AIJ" : "JE"} ${internalId}: ${oldTranId} → ${newTranId}`
                            );

                        } catch (updateErr) {
                            log.error("Update Error", `Record ${internalId}: ${updateErr.message}`);
                        }
                    });
                });

                // Summary log
                Object.keys(subsidiaryCounters).forEach((subId) => {
                    const subData = subsidiaryCounters[subId];
                    log.audit(
                        `Subsidiary ${subId}`,
                        `Prefix=${subData.prefix}, LastSeq=${subData.counter}`
                    );
                });

                log.audit("Completed", "Journal renumbering finished.");
            } catch (err) {
                log.error("Execution Error", err);
            }
        };

        return { execute };
    });
