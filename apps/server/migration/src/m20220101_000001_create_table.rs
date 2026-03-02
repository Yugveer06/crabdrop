use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Images::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Images::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .extra("DEFAULT gen_random_uuid()"),
                    )
                    .col(
                        ColumnDef::new(Images::Slug)
                            .string_len(12)
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Images::OriginalFilename).string_len(255).not_null())
                    .col(ColumnDef::new(Images::ContentType).string_len(127).not_null())
                    .col(ColumnDef::new(Images::SizeBytes).big_integer().not_null())
                    .col(ColumnDef::new(Images::R2Key).string_len(512).not_null().unique_key())
                    .col(ColumnDef::new(Images::Hash).string_len(64).not_null())
                    .col(ColumnDef::new(Images::ExpiresAt).timestamp_with_time_zone().null())
                    .col(
                        ColumnDef::new(Images::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT now()"),
                    )
                    .col(
                        ColumnDef::new(Images::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT now()"),
                    )
                    .to_owned(),
            )
            .await?;

        // Index on hash for fast deduplication lookups
        manager
            .create_index(
                Index::create()
                    .name("idx_images_hash")
                    .table(Images::Table)
                    .col(Images::Hash)
                    .to_owned(),
            )
            .await?;

        // Index on expires_at for cleanup queries (find expired images)
        manager
            .create_index(
                Index::create()
                    .name("idx_images_expires_at")
                    .table(Images::Table)
                    .col(Images::ExpiresAt)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Images::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Images {
    Table,
    Id,
    Slug,
    OriginalFilename,
    ContentType,
    SizeBytes,
    R2Key,
    Hash,
    ExpiresAt,
    CreatedAt,
    UpdatedAt,
}
