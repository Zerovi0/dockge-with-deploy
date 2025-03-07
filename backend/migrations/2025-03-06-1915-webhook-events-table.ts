import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the webhook_events table
    return knex.schema.createTable("webhook_events", (table) => {
        table.increments("id");
        table.integer("repository_id").unsigned().notNullable().references("id").inTable("git_repositories").onDelete("CASCADE");
        table.enum("provider", ["github", "gitlab", "bitbucket", "generic"]).notNullable();
        table.string("event_type", 255).notNullable();
        table.text("payload").notNullable().comment("JSON webhook payload");
        table.text("headers").notNullable().comment("JSON HTTP headers");
        table.string("signature", 1024).nullable();
        table.boolean("verified").notNullable().defaultTo(false);
        table.boolean("processed").notNullable().defaultTo(false);
        table.integer("deployment_id").unsigned().nullable().references("id").inTable("deployments");
        table.timestamp("received_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("processed_at").nullable();
        table.text("error").nullable();
        
        // Indexes for common queries
        table.index(["repository_id", "processed"]);
        table.index("received_at");
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("webhook_events");
}
