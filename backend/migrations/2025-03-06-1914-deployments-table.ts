import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the deployments table
    return knex.schema.createTable("deployments", (table) => {
        table.increments("id");
        table.string("stack_id", 255).notNullable().index();
        table.integer("build_config_id").unsigned().notNullable().references("id").inTable("build_configs").onDelete("CASCADE");
        table.integer("repository_id").unsigned().notNullable().references("id").inTable("git_repositories").onDelete("CASCADE");
        table.string("commit_sha", 255).notNullable();
        table.text("commit_message").nullable();
        table.string("commit_author", 255).nullable();
        table.string("branch", 255).notNullable();
        table.string("tag", 255).nullable();
        table.enum("status", [
            "pending", 
            "building", 
            "deploying", 
            "successful", 
            "failed", 
            "rolled_back", 
            "cancelled"
        ]).notNullable().defaultTo("pending");
        table.timestamp("started_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("completed_at").nullable();
        table.integer("duration").unsigned().nullable().comment("Duration in seconds");
        table.text("build_logs").nullable();
        table.text("deployment_logs").nullable();
        table.text("error").nullable();
        table.enum("triggered_by", ["webhook", "manual", "scheduled", "api"]).notNullable();
        table.string("triggered_by_user", 255).nullable();
        table.integer("previous_deployment_id").unsigned().nullable().references("id").inTable("deployments");
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
        
        // Indexes for common queries
        table.index(["stack_id", "status"]);
        table.index("started_at");
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("deployments");
}
