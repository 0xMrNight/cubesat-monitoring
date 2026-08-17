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

function BatteryVoltageChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    Papa.parse("/data/cubesat_telemetry_normal.csv", {
      download: true,
      header: true,
      dynamicTyping: true,

      complete: (results) => {
        const batteryData = results.data
          .filter(
            (row) =>
              row.timestamp !== undefined &&
              row.battery_voltage !== undefined &&
              row.battery_voltage !== null
          )
          .map((row) => ({
            time: Number(row.timestamp),
            voltage: Number(row.battery_voltage),
          }))

        const step = Math.ceil(batteryData.length / 300)

        const sampledData = batteryData.filter(
          (_, index) => index % step === 0
        )

        setData(sampledData)
      },
    })
  }, [])

  return (
    <div className="chart-card">

      <div className="chart-header">
        <h3>Battery Voltage</h3>
        <span>V</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(0)}s`}
          />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="voltage"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  )
}

export default BatteryVoltageChart