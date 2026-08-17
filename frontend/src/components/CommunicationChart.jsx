import { useEffect, useState } from "react"
import Papa from "papaparse"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

function CommunicationChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    Papa.parse("/data/cubesat_telemetry_normal.csv", {
      download: true,
      header: true,
      dynamicTyping: true,

      complete: (results) => {
        const communicationData = results.data
          .filter(
            (row) =>
              row.timestamp !== undefined &&
              row.signal_strength !== undefined &&
              row.packet_loss !== undefined
          )
          .map((row) => ({
            time: Number(row.timestamp),
            signal: Number(row.signal_strength),
            packetLoss: Number(row.packet_loss),
          }))

        const step = Math.ceil(communicationData.length / 300)

        const sampledData = communicationData.filter(
          (_, index) => index % step === 0
        )

        setData(sampledData)
      },
    })
  }, [])

  return (
    <div className="chart-card">

      <div className="chart-header">
        <h3>Communication</h3>
        <span>Signal / Packet Loss</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(0)}s`}
          />

          {/* Left axis — Signal Strength */}
          <YAxis
            yAxisId="signal"
            orientation="left"
            domain={["auto", "auto"]}
            label={{
              value: "dBm",
              angle: -90,
              position: "insideLeft",
            }}
          />

          {/* Right axis — Packet Loss */}
          <YAxis
            yAxisId="packet"
            orientation="right"
            domain={["auto", "auto"]}
            label={{
              value: "%",
              angle: 90,
              position: "insideRight",
            }}
          />

          <Tooltip />

          <Line
            yAxisId="signal"
            type="monotone"
            dataKey="signal"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            name="Signal Strength"
          />

          <Line
            yAxisId="packet"
            type="monotone"
            dataKey="packetLoss"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            name="Packet Loss"
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  )
}

export default CommunicationChart