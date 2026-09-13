CREATE TABLE "user_addresses" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"street" text NOT NULL,
	"street2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"is_primary" boolean NOT NULL,
	CONSTRAINT "user_addresses_user_id_type_pk" PRIMARY KEY("user_id","type"),
	CONSTRAINT "user_addresses_type_check" CHECK ("user_addresses"."type" IN ('home', 'work', 'mailing'))
);
--> statement-breakpoint
CREATE TABLE "user_phones" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"number" text NOT NULL,
	"is_primary" boolean NOT NULL,
	CONSTRAINT "user_phones_user_id_type_pk" PRIMARY KEY("user_id","type"),
	CONSTRAINT "user_phones_type_check" CHECK ("user_phones"."type" IN ('mobile', 'home', 'work'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_phones" ADD CONSTRAINT "user_phones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_addresses_one_primary" ON "user_addresses" USING btree ("user_id") WHERE "user_addresses"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "user_phones_one_primary" ON "user_phones" USING btree ("user_id") WHERE "user_phones"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));