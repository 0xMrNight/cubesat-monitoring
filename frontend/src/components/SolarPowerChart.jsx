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

function SolarPowerChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    Papa.parse("/data/cubesat_telemetry_normal.csv", {
      download: true,
      header: true,
      dynamicTyping: true,

      complete: (results) => {
        const solarData = results.data
          .filter(
            (row) =>
              row.timestamp !== undefined &&
              row.solar_power !== undefined &&
              row.solar_power !== null
          )
          .map((row) => ({
            time: Number(row.timestamp),
            power: Number(row.solar_power),
          }))

        const step = Math.ceil(solarData.length / 300)

        const sampledData = solarData.filter(
          (_, index) => index % step === 0
        )

        setData(sampledData)
      },
    })
  }, [])

  return (
    <div className="chart-card">

      <div className="chart-header">
        <h3>Solar Power</h3>
        <span>W</span>
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
            dataKey="power"
            stroke="#facc15"
            strokeWidth={2}
            dot={false}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  )
}

export default SolarPowerChart