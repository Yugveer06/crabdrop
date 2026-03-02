use axum::{
    extract::{Query, State},
    response::sse::{Event, KeepAlive, Sse},
};
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_stream::StreamExt;

use crate::compression::ProgressEvent;
use crate::error::AppError;
use crate::state::SharedState;

#[derive(Deserialize)]
pub struct ProgressQuery {
    pub job_id: String,
}

/// `GET /api/progress?job_id=<id>`
///
/// The client opens this SSE connection **before** calling `POST /api/upload`.
/// The server registers the sender here, which the upload handler picks up via `state.jobs`.
pub async fn progress(
    State(state): State<SharedState>,
    Query(params): Query<ProgressQuery>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, std::convert::Infallible>>>, AppError>
{
    let (tx, rx) = mpsc::channel::<ProgressEvent>(32);

    state.jobs.insert(params.job_id.clone(), tx);

    let stream = ReceiverStream::new(rx).map(|event| {
        let data = format!(
            r#"{{"stage":"{}","percent":{}}}"#,
            event.stage, event.percent
        );
        Ok::<Event, std::convert::Infallible>(Event::default().data(data))
    });

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
