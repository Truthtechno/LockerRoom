-- Create post_views table to track unique post views
CREATE TABLE IF NOT EXISTS "post_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_views_post_id_user_id_unique" UNIQUE("post_id","user_id")
);
