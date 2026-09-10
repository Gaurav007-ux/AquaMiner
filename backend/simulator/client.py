"""
AquaYantra — Simulator HTTP client.

Feeds simulated sensor data into the real backend HTTP ingestion endpoint.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

from simulator import Scenario, SimulationEngine, SimulatorConfig


async def run_simulation(
    base_url: str = "http://localhost:8000",
    scenario: str = "NORMAL_SURVEY",
    duration: float = 300.0,
    sample_rate: float = 2.0,
    device_id: str = "AQUAYANTRA-SIM-001",
) -> None:
    """Run a simulation and post packets to the backend."""
    config = SimulatorConfig(
        device_id=device_id,
        scenario=Scenario(scenario),
        sample_rate_hz=sample_rate,
        duration_seconds=duration,
    )
    engine = SimulationEngine(config)

    print(f"Starting simulation: scenario={scenario}, duration={duration}s, rate={sample_rate}Hz")
    print(f"Target: {base_url}/api/v1/readings")

    async with httpx.AsyncClient(timeout=10.0) as client:
        count = 0
        anomaly_count = 0
        dt = 1.0 / sample_rate

        for packet in engine.generate():
            payload = packet.model_dump(mode="json")

            try:
                resp = await client.post(f"{base_url}/api/v1/readings", json=payload)
                data = resp.json()
                count += 1

                score = data.get("anomaly_score", 0)
                status = data.get("detection_status", "BACKGROUND")

                if score > 0.5:
                    anomaly_count += 1
                    print(
                        f"[{count:5d}] ANOMALY score={score:.3f} "
                        f"conf={data.get('confidence', 0):.3f} status={status}"
                    )
                elif count % 50 == 0:
                    print(
                        f"[{count:5d}] score={score:.3f} "
                        f"quality={data.get('quality', 0):.2f} status={status}"
                    )

            except httpx.HTTPError as e:
                print(f"[{count:5d}] ERROR: {e}")

            await asyncio.sleep(dt)

    print(f"\nSimulation complete: {count} packets, {anomaly_count} anomalies detected")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AquaYantra Simulator")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--scenario", default="NORMAL_SURVEY", choices=[s.value for s in Scenario])
    parser.add_argument("--duration", type=float, default=300.0, help="Duration in seconds")
    parser.add_argument("--rate", type=float, default=2.0, help="Sample rate in Hz")
    parser.add_argument("--device", default="AQUAYANTRA-SIM-001", help="Device ID")
    args = parser.parse_args()

    asyncio.run(run_simulation(args.url, args.scenario, args.duration, args.rate, args.device))
