# Hanva Technologies CRM - Process Flow

## CRM Lifecycle Flowchart

```mermaid
graph TD
    %% Nodes
    Start([Start: Admin Uploads Leads / API Integration])
    Distribution[Distribution Logic: Auto-assign to Telecallers]
    
    subgraph Telecaller_Workflow [Telecaller Workflow]
        Login[Telecaller Logs In]
        Attendance[Check Attendance: Geo-location Captured]
        ViewLeads[View Assigned Leads]
        Action[Execute: Call / WhatsApp]
        UpdateStatus[Update Status: Interested / Not Interested / Follow-up]
    end
    
    subgraph Monitoring_System [Monitoring System]
        LiveFeed[Manager/Admin Views Live Activity Feed]
        Stats[Performance Stats & Real-time Logs]
    end
    
    End([End: Deal Closure / Reporting])

    %% Connections
    Start --> Distribution
    Distribution --> Login
    Login --> Attendance
    Attendance --> ViewLeads
    ViewLeads --> Action
    Action --> UpdateStatus
    UpdateStatus --> LiveFeed
    LiveFeed --> Stats
    UpdateStatus --> End
    
    %% Styling
    style Start fill:#2563eb,stroke:#fff,stroke-width:2px,color:#fff
    style End fill:#16a34a,stroke:#fff,stroke-width:2px,color:#fff
    style Distribution fill:#f59e0b,stroke:#fff,stroke-width:2px,color:#fff
    style Telecaller_Workflow fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px
    style Monitoring_System fill:#e0f2fe,stroke:#3b82f6,stroke-width:2px
```

## Description
1.  **Start**: Leads are entered into the system via CSV upload or API integration.
2.  **Distribution**: The system automatically assigns leads to Telecallers based on defined logic (department, availability, etc.).
3.  **Action**:
    *   Telecaller logs in.
    *   Attendance is marked with Geo-location.
    *   Telecaller sees their assigned leads.
4.  **Execution**: Telecaller performs actions (Call, WhatsApp) and updates the lead status.
5.  **Monitoring**: Managers and Admins can view a live feed of activities and performance statistics.
6.  **End**: The process concludes with deal closure or reporting.
