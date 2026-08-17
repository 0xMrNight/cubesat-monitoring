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

function TemperatureChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    Papa.parse("/data/cubesat_telemetry_normal.csv", {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => {
      const temperatureData = results.data
  .filter(
    (row) =>
      row.timestamp !== undefined &&
      row.temperature !== undefined &&
      row.temperature !== null
  )
  .map((row) => ({
    time: Number(row.timestamp),
    temperature: Number(row.temperature),
  }))

// Keep the original dataset intact,
// but display fewer points for a cleaner graph.
const step = Math.ceil(temperatureData.length / 300)

const sampledData = temperatureData.filter(
  (_, index) => index % step === 0
)

setData(sampledData)
      },
    })
  }, [])

  return (
    <div className="chart-card">

      <div className="chart-header">
        <h3>Temperature</h3>
        <span>°C</span>
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
            dataKey="temperature"
            stroke="#4ade80"
            strokeWidth={2}
            dot={false}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  )
}

export default TemperatureChart