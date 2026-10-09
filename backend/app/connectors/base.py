"""The connector interface every data source implements — fetch, normalize,
and report status honestly. A connector that has no working credentials or
network path must say so explicitly rather than silently returning nothing
or fabricating a response. See nasa_power.py for the one connector in this
pass that is genuinely wired to a live external API."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum


class ConnectorStatus(str, Enum):
    OK = "ok"
    UNCONFIGURED = "unconfigured"  # no credentials/access — not a failure, just not set up
    ERROR = "error"  # attempted and failed (timeout, bad response, etc.)
    MOCK = "mock"  # explicitly a development-only mock adapter, never shown as live


@dataclass
class ConnectorResult:
    status: ConnectorStatus
    data: list[dict] | None
    message: str
    source_url: str | None = None


class DataConnector(ABC):
    name: str
    evidence_class: str  # the EvidenceClass this connector's output should be labeled with

    @abstractmethod
    async def fetch(self, **kwargs) -> ConnectorResult: ...
