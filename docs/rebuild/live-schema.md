# heyScottyBro: live database schema

Read from Supabase project `mogoybejtmkoheqvfvuc` on 2026-09-16 (PostgREST schema description plus exact row counts, read-only). `*` = required (NOT NULL without a default). Companion to [current-system.md](current-system.md).

### `_calendula_migrations` — 5 rows

| column | type | notes |
|---|---|---|
| name * | text | **PK** |
| applied_at * | timestamp with time zone | default=now() |

### `accountability_state` — 1 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| state * | jsonb |  |
| updated_at * | timestamp with time zone | default=now() |

### `agent_actions` — 766 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| agent_id | text | default=frodo |
| tool * | text |  |
| collection | text |  |
| item_id | text |  |
| args | jsonb |  |
| status * | text | default=ok |
| error | text |  |
| created_at * | timestamp with time zone | default=now() |

### `agent_sessions` — 2 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| agent_id * | text |  |
| display | jsonb |  |
| convo | jsonb |  |
| updated_at | timestamp with time zone | default=now() |

### `brain_links` — 1585 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| source_slug * | text |  |
| target_slug * | text |  |
| created_at | timestamp with time zone | default=now() |

### `brain_nodes` — 533 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| slug * | text |  |
| title * | text |  |
| body | text | default= |
| type | text | default=note |
| tags | text[] |  |
| source | text | default= |
| created_at | timestamp with time zone | default=now() |
| updated_at | timestamp with time zone | default=now() |

### `budget_config` — 1 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| categories | jsonb |  |
| income_sources | jsonb |  |
| recurring_bills | jsonb |  |
| created_at | timestamp with time zone | default=now() |
| tax_rate | numeric | default=0.18 |
| starting_balance | numeric | default=0 |
| pay_schedule | jsonb |  |
| simulations | jsonb |  |
| transactions | jsonb |  |
| category_budgets | jsonb |  |
| savings_goals | jsonb |  |

### `bugs` — 55 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| description | text |  |
| steps | text |  |
| page | text |  |
| priority * | text | default=medium |
| status * | text | default=open |
| notes | text |  |
| resolved_at | timestamp with time zone |  |
| created_at * | timestamp with time zone | default=now() |
| updated_at * | timestamp with time zone | default=now() |
| type * | text | default=bug |
| screenshots * | jsonb |  |

### `calendula_activity_holds` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| activity_type_id * | uuid | FK → calendula_activity_types.id |
| starts_at * | timestamp with time zone |  |
| ends_at * | timestamp with time zone |  |
| status * | text | default=held |
| participants | uuid[] |  |
| created_at | timestamp with time zone | default=now() |

### `calendula_activity_types` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| min_duration_hours * | integer |  |
| requires_overnight * | boolean | default=false |
| season_start | date |  |
| season_end | date |  |
| lead_time_days * | integer | default=0 |
| buffer_after_hours * | integer | default=0 |
| weather_sensitive * | boolean | default=false |

### `calendula_attention_profile` — 1 rows

| column | type | notes |
|---|---|---|
| user_id * | uuid | **PK** |
| attention_budget_per_day * | integer | default=5 |
| min_gap_minutes * | integer | default=45 |
| quiet_start | time without time zone |  |
| quiet_end | time without time zone |  |
| batch_by_default * | boolean | default=true |
| promote_after_defers * | integer | default=3 |

### `calendula_categories` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| color | text |  |
| created_at | timestamp with time zone | default=now() |

### `calendula_chat_messages` — 44 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| role * | text |  |
| content * | jsonb |  |
| created_at * | timestamp with time zone | default=now() |
| seq * | bigint |  |

### `calendula_completions` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| task_id | uuid | FK → calendula_tasks.id |
| habit_id | uuid | FK → calendula_habits.id |
| placement_id | uuid | FK → calendula_placements.id |
| planned_minutes | integer |  |
| actual_minutes | integer |  |
| completed * | boolean |  |
| logged_at | timestamp with time zone | default=now() |

### `calendula_duration_calibration` — 0 rows

| column | type | notes |
|---|---|---|
| user_id * | uuid | **PK** |
| category_id * | uuid | **PK** FK → calendula_categories.id |
| multiplier * | numeric | default=1 |
| sample_size * | integer | default=0 |
| updated_at | timestamp with time zone | default=now() |

### `calendula_energy_windows` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| day_of_week | integer |  |
| start_time * | time without time zone |  |
| end_time * | time without time zone |  |
| quality * | numeric |  |
| label * | public.calendula_energy_label |  |

### `calendula_fixed_blocks` — 6 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| starts_at * | timestamp with time zone |  |
| ends_at * | timestamp with time zone |  |
| location | text |  |
| travel_buffer_minutes * | integer | default=0 |
| high_exertion * | boolean | default=false |
| rrule | text |  |
| source * | text | default=manual |
| external_id | text |  |
| created_at | timestamp with time zone | default=now() |

### `calendula_habits` — 1 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| duration_minutes * | integer |  |
| target_sessions_per_week * | integer |  |
| min_spacing_hours * | integer | default=24 |
| preferred_labels | public.calendula_energy_label[] |  |
| earliest_time | time without time zone |  |
| latest_time | time without time zone |  |
| location | text |  |
| travel_buffer_minutes * | integer | default=0 |
| active * | boolean | default=true |

### `calendula_meeting_offer_slots` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| offer_id * | uuid | FK → calendula_meeting_offers.id |
| starts_at * | timestamp with time zone |  |
| ends_at * | timestamp with time zone |  |
| displacement_cost * | numeric |  |
| placement_id | uuid | FK → calendula_placements.id |
| chosen * | boolean | default=false |

### `calendula_meeting_offers` — 1 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| person_ids | uuid[] |  |
| purpose | text |  |
| meeting_type * | text |  |
| duration_minutes * | integer |  |
| expires_at * | timestamp with time zone |  |
| status * | text | default=open |
| created_at | timestamp with time zone | default=now() |

### `calendula_people` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| desired_cadence_days | integer |  |
| last_interaction_at | timestamp with time zone |  |
| location | text |  |
| notes | text |  |
| created_at | timestamp with time zone | default=now() |

### `calendula_placements` — 60 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| source_type * | text |  |
| source_id * | uuid |  |
| title * | text |  |
| starts_at * | timestamp with time zone |  |
| ends_at * | timestamp with time zone |  |
| hardness * | text |  |
| pinned * | boolean | default=false |
| location | text |  |
| run_id | uuid |  |
| created_at | timestamp with time zone | default=now() |

### `calendula_reminder_deliveries` — 5 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| reminder_id * | uuid | FK → calendula_reminders.id |
| batch_id | uuid |  |
| scheduled_at * | timestamp with time zone |  |
| delivered_at | timestamp with time zone |  |
| channel * | text |  |
| receptivity | numeric |  |
| urgency | numeric |  |
| outcome | text |  |
| created_at | timestamp with time zone | default=now() |

### `calendula_reminders` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| category_id | uuid | FK → calendula_categories.id |
| title * | text |  |
| body | text |  |
| kind * | public.calendula_reminder_kind |  |
| due_at | timestamp with time zone |  |
| window_start | timestamp with time zone |  |
| window_end | timestamp with time zone |  |
| trigger * | public.calendula_trigger_type | default=time |
| trigger_placement_id | uuid | FK → calendula_placements.id |
| lead_minutes * | integer | default=0 |
| location | text |  |
| importance * | integer | default=3 |
| cost * | public.calendula_interruption_cost | default=notify |
| person_id | uuid | FK → calendula_people.id |
| recurrence | text |  |
| status * | public.calendula_reminder_status | default=pending |
| defer_count * | integer | default=0 |
| promotion_offered * | boolean | default=false |
| source * | text | default=user |
| derived_from_type | text |  |
| derived_from_id | uuid |  |
| created_at | timestamp with time zone | default=now() |
| completed_at | timestamp with time zone |  |

### `calendula_schedule_runs` — 69 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| trigger * | text |  |
| horizon_start * | timestamp with time zone |  |
| horizon_end * | timestamp with time zone |  |
| unplaceable * | jsonb |  |
| moved_count * | integer | default=0 |
| duration_ms | integer |  |
| created_at | timestamp with time zone | default=now() |

### `calendula_scheduling_profile` — 1 rows

| column | type | notes |
|---|---|---|
| user_id * | uuid | **PK** |
| timezone * | text | default=America/St_Johns |
| sleep_start * | time without time zone | default=23:30:00 |
| sleep_end * | time without time zone | default=07:30:00 |
| horizon_days * | integer | default=14 |
| far_horizon_days * | integer | default=180 |
| block_minutes * | integer | default=15 |
| freeze_window_hours * | integer | default=24 |
| max_task_minutes_per_day * | integer | default=300 |
| movement_penalty * | numeric | default=0.3 |
| min_break_minutes * | integer | default=15 |
| brief_hour * | integer | default=7 |
| created_at | timestamp with time zone | default=now() |

### `calendula_tasks` — 6 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| category_id | uuid | FK → calendula_categories.id |
| title * | text |  |
| estimated_minutes * | integer |  |
| remaining_minutes * | integer |  |
| deadline | timestamp with time zone |  |
| priority * | integer | default=3 |
| min_chunk_minutes * | integer | default=45 |
| max_chunk_minutes * | integer | default=180 |
| splittable * | boolean | default=true |
| preferred_labels | public.calendula_energy_label[] |  |
| status * | text | default=active |
| skip_count * | integer | default=0 |
| created_at | timestamp with time zone | default=now() |
| demotion_offered * | boolean | default=false |

### `context_entries` — 35 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| text * | text |  |
| tags | jsonb |  |
| by | text | default=manual |
| why | text |  |
| ts | bigint |  |
| created_at * | timestamp with time zone | default=now() |

### `courses` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| code * | text |  |
| name * | text |  |
| term | text | default= |
| instructor | text | default= |
| target_grade | numeric |  |
| color | text | default=#5B8DEF |
| archived * | boolean | default=false |
| created_at | timestamp with time zone | default=now() |

### `date_completed` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| emoji | text | default=💖 |
| note | text |  |
| memory | text |  |
| done_on | date |  |
| created_at * | timestamp with time zone | default=now() |

### `date_ideas` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| emoji | text | default=💖 |
| note | text |  |
| created_at * | timestamp with time zone | default=now() |

### `doc_links` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid | default=auth.uid() |
| entity_type * | text |  |
| entity_id * | text |  |
| node_slug | text |  |
| read * | boolean | default=false |
| read_at | timestamp with time zone |  |
| created_at * | timestamp with time zone | default=now() |
| document_id | uuid | FK → documents.id |

### `document_shares` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| document_id * | uuid | FK → documents.id |
| token * | text | default=encode(extensions.gen_random_bytes(32), 'hex'::text) |
| created_by * | uuid |  |
| shared_with_email | text |  |
| expires_at | timestamp with time zone |  |
| accessed_at | timestamp with time zone |  |
| access_count | integer | default=0 |
| revoked | boolean | default=false |
| created_at | timestamp with time zone | default=now() |

### `documents` — 4 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| filename * | text |  |
| storage_path * | text |  |
| mime_type * | text |  |
| size_bytes * | bigint |  |
| description | text | default= |
| tags | text[] |  |
| created_at | timestamp with time zone | default=now() |
| updated_at | timestamp with time zone | default=now() |

### `event_types` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| color | text | default=#22d3ee |
| auto_tasks | jsonb |  |
| created_at | timestamp with time zone | default=now() |

### `events` — 68 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| description | text |  |
| date * | date |  |
| created_at | timestamp with time zone | default=now() |
| project_id | uuid | FK → projects.id |
| event_type_id | uuid | FK → event_types.id |
| recurrence | text | default=none |
| recur_until | date |  |
| recur_times | integer |  |
| cost | numeric |  |
| time | time without time zone |  |
| end_time | time without time zone |  |
| end_date | date |  |
| location | text |  |
| all_day | boolean | default=false |
| start_time | time without time zone |  |

### `food_logs` — 27 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| profile_id * | uuid | FK → nutrition_profiles.id |
| date * | date | default=CURRENT_DATE |
| meal_type | text | default=snack |
| name * | text |  |
| description | text | default= |
| calories * | numeric | default=0 |
| protein_g | numeric | default=0 |
| carbs_g | numeric | default=0 |
| fat_g | numeric | default=0 |
| quantity | numeric | default=1 |
| source | text | default=manual |
| image_path | text |  |
| items | jsonb |  |
| recipe_id | uuid |  |
| created_at | timestamp with time zone | default=now() |

### `grades` — 4 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| course | text | default= |
| name * | text |  |
| earned | numeric |  |
| max * | numeric | default=100 |
| weight * | numeric | default=0 |
| feedback | text | default= |
| sort_order | integer |  |
| created_at | timestamp with time zone | default=now() |
| course_id | uuid | FK → courses.id |

### `grocery_receipt_items` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| receipt_id * | uuid | FK → grocery_receipts.id |
| raw_text * | text |  |
| quantity | numeric | default=1 |
| unit_price | numeric |  |
| total_price | numeric |  |
| product_id | uuid |  |
| resolved_grams | numeric |  |
| resolved | boolean | default=false |
| created_at | timestamp with time zone | default=now() |

### `grocery_receipts` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| store_id | uuid | FK → grocery_stores.id |
| purchase_date * | date | default=CURRENT_DATE |
| subtotal | numeric |  |
| total | numeric |  |
| image_path | text |  |
| created_at | timestamp with time zone | default=now() |

### `grocery_stores` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| website | text | default= |
| created_at | timestamp with time zone | default=now() |

### `hike_attendees` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| hike_import_id * | uuid | FK → hiker_imports.id |
| member_id * | uuid | FK → hiker_members.id |
| created_at | timestamp with time zone | default=now() |

### `hiker_imports` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| filename | text |  |
| imported_at | date |  |
| first_timers | integer | default=0 |
| returning_count | integer | default=0 |
| total | integer | default=0 |
| created_at | timestamp with time zone | default=now() |
| hike_name | text |  |
| hike_date | date |  |

### `hiker_members` — 116 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| first * | text |  |
| last * | text |  |
| email | text | default= |
| phone | text | default= |
| attendance | integer | default=1 |
| joined_date | date |  |
| created_at | timestamp with time zone | default=now() |

### `income_sources` — 1 rows

| column | type | notes |
|---|---|---|
| id * | text | **PK** |
| user_id * | uuid |  |
| data * | jsonb |  |
| created_at | timestamp with time zone | default=now() |

### `initiatives` — 2 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| project_id | uuid | FK → projects.id |
| name * | text |  |
| description | text | default= |
| recurrence | text | default=weekly |
| active | boolean | default=true |
| created_at | timestamp with time zone | default=now() |

### `journal` — 22 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| entry * | text |  |
| date * | date |  |
| created_at | timestamp with time zone | default=now() |

### `messages` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| channel | text | default=manual |
| sender | text | default= |
| subject | text | default= |
| body * | text |  |
| draft | text | default= |
| status | text | default=needs_reply |
| flagged | boolean | default=true |
| received_at | timestamp with time zone | default=now() |
| created_at | timestamp with time zone | default=now() |
| external_id | text |  |
| thread_id | text |  |
| read * | boolean | default=false |

### `nutrition_profiles` — 1 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| emoji | text | default=🙂 |
| color | text | default=#6366f1 |
| sex | text |  |
| height_cm | numeric |  |
| birth_year | integer |  |
| activity_level | text | default=moderate |
| goal | text | default=maintain |
| target_calories | integer |  |
| start_weight_kg | numeric |  |
| goal_weight_kg | numeric |  |
| sort_order | integer | default=0 |
| created_at | timestamp with time zone | default=now() |

### `projects` — 8 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| description | text | default= |
| color | text | default=#6366f1 |
| created_at | timestamp with time zone | default=now() |
| parent_id | uuid | FK → projects.id |
| archived | boolean | default=false |
| due_date | date |  |
| sort_order | integer |  |

### `recipes` — 26 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| description | text | default= |
| servings | integer | default=1 |
| prep_minutes | integer | default=0 |
| cook_minutes | integer | default=0 |
| ingredients | jsonb |  |
| steps | jsonb |  |
| calories_per_serving | numeric | default=0 |
| protein_g | numeric | default=0 |
| carbs_g | numeric | default=0 |
| fat_g | numeric | default=0 |
| tags | text[] |  |
| image_path | text |  |
| source | text | default=manual |
| favorite | boolean | default=false |
| created_at | timestamp with time zone | default=now() |
| updated_at | timestamp with time zone | default=now() |

### `recurring_bills` — 11 rows

| column | type | notes |
|---|---|---|
| id * | text | **PK** |
| user_id * | uuid |  |
| data * | jsonb |  |
| created_at | timestamp with time zone | default=now() |

### `reminders` — 134 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| name * | text |  |
| date | date |  |
| recurrence | text | default=none |
| completed | boolean | default=false |
| completed_date | date |  |
| created_at | timestamp with time zone | default=now() |
| project_id | uuid | FK → projects.id |
| recur_until | date |  |
| recur_times | integer |  |
| time | time without time zone |  |
| description | text |  |
| show_on_calendar | boolean | default=true |
| priority | text | default=none |
| sort_order | integer |  |
| course_id | uuid | FK → courses.id |
| event_id | uuid | FK → events.id |

### `research_requests` — 1 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid | default=auth.uid() |
| title * | text |  |
| details | text | default= |
| status * | text | default=open |
| assignee | text | default= |
| created_at * | timestamp with time zone | default=now() |
| updated_at * | timestamp with time zone | default=now() |

### `snippets` — 7 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| title * | text |  |
| value * | text |  |
| type * | text | default=other |
| secret * | boolean | default=true |
| notes | text |  |
| created_at * | timestamp with time zone | default=now() |
| updated_at * | timestamp with time zone | default=now() |

### `transactions` — 0 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| description * | text |  |
| amount * | numeric |  |
| type * | text |  |
| category | text | default=Other |
| date * | date |  |
| notes | text |  |
| created_at | timestamp with time zone | default=now() |
| fulfills_recurring_id | text | FK → recurring_bills.id |
| fulfills_income_id | text | FK → income_sources.id |
| reconciled | boolean | default=false |
| is_bill | boolean | default=false |

### `weed_state` — 1 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| state * | jsonb |  |
| updated_at * | timestamp with time zone | default=now() |

### `weight_logs` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| profile_id * | uuid | FK → nutrition_profiles.id |
| date * | date | default=CURRENT_DATE |
| weight_kg * | numeric |  |
| note | text | default= |
| created_at | timestamp with time zone | default=now() |

### `work_log` — 26 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| date * | date | default=CURRENT_DATE |
| task * | text |  |
| notes | text | default= |
| project_id | uuid | FK → projects.id |
| minutes | integer |  |
| created_at | timestamp with time zone | default=now() |

### `workouts` — 3 rows

| column | type | notes |
|---|---|---|
| id * | uuid | default=gen_random_uuid() · **PK** |
| user_id * | uuid |  |
| date * | date | default=CURRENT_DATE |
| exercise * | text |  |
| weight | numeric | default=0 |
| reps | integer | default=0 |
| sets | integer | default=1 |
| notes | text | default= |
| created_at | timestamp with time zone | default=now() |

