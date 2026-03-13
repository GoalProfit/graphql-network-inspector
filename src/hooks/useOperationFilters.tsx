import { createContext, useContext, useEffect, useState } from "react"
import {
  getOperationFilters,
  type IOperationFilters,
  setOperationFilters as persistOperationFilters,
} from "../services/operationFiltersService"

export type { IOperationFilters } from "../services/operationFiltersService"

interface IOperationFilterContext {
  operationFilters: IOperationFilters
  setOperationFilters: React.Dispatch<React.SetStateAction<IOperationFilters>>
}

const OperationFilersContext =
  createContext<IOperationFilterContext | null>(null)

const DEFAULT_FILTERS = {
  query: true,
  mutation: true,
  subscription: false,
  persisted: true,
}

export const OperationFiltersProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [operationFilters, setOperationFilters] = useState<IOperationFilters>(
    DEFAULT_FILTERS
  )
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    getOperationFilters((filters) => {
      setOperationFilters(filters)
      setIsLoaded(true)
    })
  }, [])

  const setOperationFiltersWithPersistence = (
    value: React.SetStateAction<IOperationFilters>
  ) => {
    setOperationFilters((prev) => {
      const next = typeof value === "function" ? value(prev) : value
      if (isLoaded) {
        persistOperationFilters(next)
      }
      return next
    })
  }

  return (
    <OperationFilersContext.Provider
      value={{
        operationFilters,
        setOperationFilters: setOperationFiltersWithPersistence,
      }}
    >
      {children}
    </OperationFilersContext.Provider>
  )
}

export const useOperationFilters = () => {
  const context = useContext(OperationFilersContext)
  if (!context) {
    throw new Error(
      "useOperationFilters must be used within a OperationFiltersProvider"
    )
  }
  return context
}
