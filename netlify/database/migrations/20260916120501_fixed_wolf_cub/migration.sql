CREATE TABLE "forwarder_projects" (
	"id" serial PRIMARY KEY,
	"project_ref" varchar(255) UNIQUE,
	"client_name" varchar(255) DEFAULT 'Nuevo Cliente',
	"status" varchar(50) DEFAULT 'BORRADOR',
	"global_margin_percentage" numeric,
	"documents" jsonb DEFAULT '[]',
	"items" jsonb DEFAULT '[]',
	"land_origin" varchar(255),
	"land_destination" varchar(255),
	"land_distance" numeric,
	"land_freight_cost" numeric,
	"total_trucks" integer,
	"road_transit_days" numeric,
	"road_net_margin" numeric,
	"pre_carriage" jsonb DEFAULT '{}',
	"on_carriage" jsonb DEFAULT '{}',
	"land_route" jsonb DEFAULT '{}',
	"route_and_chartering" jsonb,
	"data" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_forwarder_projects_ref" ON "forwarder_projects" ("project_ref");