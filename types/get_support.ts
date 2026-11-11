export interface ReportIssue {
  /** POST /api/v1/report/create-report-issue body */
  request: {
    /** Category name and selected issue, separated by " - ". */
    subject: string;
    /** Specific issue selected in the form. */
    specific_issue: string;
    /** User-entered description only. */
    description: string;
    /** Public URLs returned by the media upload API, in upload order. */
    media_urls: string[];
  };

  /** POST /api/v1/report/create-report-issue: ticket created (may arrive wrapped in `responseData`) */
  response: {
    id?: string;
    reportId: string;
    ticketId: string;
    userId?: string;
    subject: string;
    description: string;
    mediaUrls: string[];
    status: string;
    createdAt?: string;
    updatedAt?: string;
    reportIssueAssignments?: {
      user: {
        id: string;
        name: string;
        email: string;
        mobile_number: string;
      };
    }[];
    reportIssueActivities?: {
      id: string;
      issueId: string;
      senderId: string;
      message: string;
      mediaUrls: string[];
      createdAt: string;
      sender: {
        id: string;
        name: string;
        email: string;
        tier: string;
      };
    }[];
  };

  /** POST /api/v1/report/report-issue-reply body */
  replyRequest: {
    issue_id: string;
    sender_id: string;
    message: string;
    media_urls?: string[];
  };

  /** POST /api/v1/report/report-issue-reply response */
  replyResponse: {
    id: string;
    senderId: string;
    message: string;
    mediaUrls: string[];
    createdAt: string;
  };

  /** GET /api/v1/report/get-report-issues: all tickets of the logged-in user (no payload, id comes from the bearer token) */
  list: {
    response: {
      id: string;
      ticketId: string;
      userId: string;
      subject: string;
      description: string;
      mediaUrls: string[];
      status: string;
      createdAt: string;
      updatedAt: string;
      reportIssueAssignments: {
        user: {
          id: string;
          name: string;
          email: string;
          mobile_number: string;
        };
      }[];
    }[];
  };

  /** POST /api/v1/report/report_issue_media_upload (multipart/form-data, reusable) */
  upload: {
    request: {
      /** Sent as repeated multipart parts named "files" */
      files: File[];
    };
    response: {
      /** Hosted public URLs, same order as the files sent */
      urls: string[];
    };
  };

  /** Static support catalog used by the form (categories, sub-subjects, statuses) */
  catalog: {
    subjects: {
      key: string;
      name: string;
      description: string;
      subsubjects: string[];
    }[];
    ticket_statuses: string[];
  };
}
