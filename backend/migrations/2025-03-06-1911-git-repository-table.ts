import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the git_repositories table
    return knex.schema.createTable("git_repositories", (table) => {
        table.increments("id");
        table.string("stack_id", 255).notNullable().index();
        table.string("url", 1024).notNullable();
        table.string("branch", 255).notNullable().defaultTo("main");
        table.enum("auth_type", ["none", "ssh_key", "http_token"]).notNullable().defaultTo("none");
        table.text("credentials_json").nullable().comment("Encrypted JSON containing credentials");
        table.string("webhook_secret", 255).nullable();
        table.string("webhook_url", 1024).nullable();
        table.enum("provider", ["github", "gitlab", "bitbucket", "generic"]).notNullable().defaultTo("generic");
        table.boolean("auto_sync").notNullable().defaultTo(false);
        table.timestamp("last_synced_at").nullable();
        table.string("last_synced_commit", 255).nullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
        
        // Add a unique constraint to ensure one repository per stack
        table.unique(["stack_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("git_repositories");
}
