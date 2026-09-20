-- Index every foreign key column, plus four composites for the hot read paths.
--
-- PostgreSQL indexes the REFERENCED side of a foreign key, never the
-- referencing column. This schema declared 56 foreign keys against 6
-- non-unique indexes, so the tenancy chain every client request walks —
-- engagements.client_id -> projects.engagement_id -> child.project_id — was
-- three sequential scans, and every ON DELETE RESTRICT check scanned the whole
-- child table.
--
-- CONCURRENTLY IS NOT USED HERE. Prisma applies each migration inside a
-- transaction, and CREATE INDEX CONCURRENTLY cannot run in one. Every statement
-- is IF NOT EXISTS, so on a large table you can build the index ahead of time
-- without blocking writes:
--
--   CREATE INDEX CONCURRENTLY "invoices_engagement_id_status_idx"
--     ON "invoices"("engagement_id", "status");
--
-- and this migration will then skip it. On a small table the brief lock a plain
-- CREATE INDEX takes is not worth the ceremony.

CREATE INDEX IF NOT EXISTS "api_keys_org_id_idx" ON "api_keys"("org_id");
CREATE INDEX IF NOT EXISTS "bench_deployed_to_idx" ON "bench"("deployed_to");
CREATE INDEX IF NOT EXISTS "blueprints_recommended_package_id_idx" ON "blueprints"("recommended_package_id");
CREATE INDEX IF NOT EXISTS "change_requests_project_id_idx" ON "change_requests"("project_id");
CREATE INDEX IF NOT EXISTS "compliance_items_org_id_idx" ON "compliance_items"("org_id");
CREATE INDEX IF NOT EXISTS "contracts_engagement_id_idx" ON "contracts"("engagement_id");
CREATE INDEX IF NOT EXISTS "contracts_order_id_idx" ON "contracts"("order_id");
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations"("last_message_at");
CREATE INDEX IF NOT EXISTS "credential_vault_project_id_idx" ON "credential_vault"("project_id");
CREATE INDEX IF NOT EXISTS "credits_consumed_by_idx" ON "credits"("consumed_by");
CREATE INDEX IF NOT EXISTS "credits_source_eng_id_idx" ON "credits"("source_eng_id");
CREATE INDEX IF NOT EXISTS "custom_lines_workspace_id_idx" ON "custom_lines"("workspace_id");
CREATE INDEX IF NOT EXISTS "dependencies_to_id_idx" ON "dependencies"("to_id");
CREATE INDEX IF NOT EXISTS "engagements_client_id_status_idx" ON "engagements"("client_id", "status");
CREATE INDEX IF NOT EXISTS "engagements_program_id_idx" ON "engagements"("program_id");
CREATE INDEX IF NOT EXISTS "estimates_workspace_id_idx" ON "estimates"("workspace_id");
CREATE INDEX IF NOT EXISTS "events_code_idx" ON "events"("code");
CREATE INDEX IF NOT EXISTS "events_engagement_id_created_at_idx" ON "events"("engagement_id", "created_at");
CREATE INDEX IF NOT EXISTS "events_project_id_created_at_idx" ON "events"("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "feature_units_service_id_idx" ON "feature_units"("service_id");
CREATE INDEX IF NOT EXISTS "files_project_id_archived_created_at_idx" ON "files"("project_id", "archived", "created_at");
CREATE INDEX IF NOT EXISTS "follow_ups_assigned_to_due_at_idx" ON "follow_ups"("assigned_to", "due_at");
CREATE INDEX IF NOT EXISTS "follow_ups_lead_id_idx" ON "follow_ups"("lead_id");
CREATE INDEX IF NOT EXISTS "follow_ups_status_due_at_idx" ON "follow_ups"("status", "due_at");
CREATE INDEX IF NOT EXISTS "handovers_project_id_idx" ON "handovers"("project_id");
CREATE INDEX IF NOT EXISTS "invoices_engagement_id_status_idx" ON "invoices"("engagement_id", "status");
CREATE INDEX IF NOT EXISTS "invoices_org_id_idx" ON "invoices"("org_id");
CREATE INDEX IF NOT EXISTS "job_applications_job_id_idx" ON "job_applications"("job_id");
CREATE INDEX IF NOT EXISTS "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");
CREATE INDEX IF NOT EXISTS "leads_assigned_to_idx" ON "leads"("assigned_to");
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads"("stage");
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "orders_estimate_id_idx" ON "orders"("estimate_id");
CREATE INDEX IF NOT EXISTS "orders_org_id_idx" ON "orders"("org_id");
CREATE INDEX IF NOT EXISTS "packages_service_id_idx" ON "packages"("service_id");
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX IF NOT EXISTS "previews_package_id_idx" ON "previews"("package_id");
CREATE INDEX IF NOT EXISTS "projects_engagement_id_idx" ON "projects"("engagement_id");
CREATE INDEX IF NOT EXISTS "projects_order_id_idx" ON "projects"("order_id");
CREATE INDEX IF NOT EXISTS "projects_service_id_idx" ON "projects"("service_id");
CREATE INDEX IF NOT EXISTS "proposals_lead_id_idx" ON "proposals"("lead_id");
CREATE INDEX IF NOT EXISTS "referrals_referrer_id_idx" ON "referrals"("referrer_id");
CREATE INDEX IF NOT EXISTS "reviews_reviewee_id_idx" ON "reviews"("reviewee_id");
CREATE INDEX IF NOT EXISTS "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");
CREATE INDEX IF NOT EXISTS "revrec_ledger_engagement_id_date_idx" ON "revrec_ledger"("engagement_id", "date");
CREATE INDEX IF NOT EXISTS "rfps_org_id_idx" ON "rfps"("org_id");
CREATE INDEX IF NOT EXISTS "screening_results_org_id_idx" ON "screening_results"("org_id");
CREATE INDEX IF NOT EXISTS "sdn_notes_rfp_id_idx" ON "sdn_notes"("rfp_id");
CREATE INDEX IF NOT EXISTS "sdn_notes_workspace_id_idx" ON "sdn_notes"("workspace_id");
CREATE INDEX IF NOT EXISTS "showcase_items_project_id_idx" ON "showcase_items"("project_id");
CREATE INDEX IF NOT EXISTS "signatures_contract_id_idx" ON "signatures"("contract_id");
CREATE INDEX IF NOT EXISTS "signatures_signer_user_id_idx" ON "signatures"("signer_user_id");
CREATE INDEX IF NOT EXISTS "stakeholders_program_id_idx" ON "stakeholders"("program_id");
CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX IF NOT EXISTS "ticket_replies_ticket_id_idx" ON "ticket_replies"("ticket_id");
CREATE INDEX IF NOT EXISTS "tickets_project_id_status_idx" ON "tickets"("project_id", "status");
CREATE INDEX IF NOT EXISTS "timesheet_lines_timesheet_id_idx" ON "timesheet_lines"("timesheet_id");
CREATE INDEX IF NOT EXISTS "tool_conversions_session_id_idx" ON "tool_conversions"("session_id");
CREATE INDEX IF NOT EXISTS "users_org_id_idx" ON "users"("org_id");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_id_idx" ON "webhook_deliveries"("endpoint_id");
CREATE INDEX IF NOT EXISTS "webhook_endpoints_org_id_idx" ON "webhook_endpoints"("org_id");
CREATE INDEX IF NOT EXISTS "wip_ledger_engagement_id_snapshot_date_idx" ON "wip_ledger"("engagement_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "workspaces_user_id_idx" ON "workspaces"("user_id");
