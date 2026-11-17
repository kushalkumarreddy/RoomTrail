package com.roomtrail.service;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.FontFactory;
import com.lowagie.text.HeaderFooter;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.roomtrail.dto.TripTimelineDto;
import com.roomtrail.dto.TripTimelineStopDto;
import com.roomtrail.entity.Property;
import com.roomtrail.entity.RoutePoint;
import com.roomtrail.entity.Trip;
import com.roomtrail.entity.User;
import com.roomtrail.entity.Visit;
import com.roomtrail.repository.PropertyRepository;
import com.roomtrail.repository.RoutePointRepository;
import com.roomtrail.repository.TripRepository;
import com.roomtrail.repository.UserRepository;
import com.roomtrail.repository.VisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class TravelHistoryExportService {

    private final TripRepository tripRepository;
    private final RoutePointRepository routePointRepository;
    private final VisitRepository visitRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TripService tripService;

    // RoomTrail Palette Colors for OpenPDF
    private static final Color COLOR_PRIMARY = new Color(11, 25, 44);      // Deep Navy #0B192C
    private static final Color COLOR_SECONDARY = new Color(30, 62, 98);    // Rich Blue #1E3E62
    private static final Color COLOR_ACCENT = new Color(2, 132, 199);      // Light Blue #0284C7
    private static final Color COLOR_LIGHT_BG = new Color(248, 250, 252);  // Slate 50 #F8FAFC
    private static final Color COLOR_BORDER = new Color(203, 213, 225);    // Slate 300 #CBD5E1
    private static final Color COLOR_TEXT_DARK = new Color(15, 23, 42);    // Slate 900
    private static final Color COLOR_TEXT_MUTED = new Color(100, 116, 139);// Slate 500
    private static final Color COLOR_SUCCESS = new Color(16, 185, 129);    // Emerald 500
    private static final Color COLOR_ROW_ALT = new Color(241, 245, 249);   // Slate 100

    public TravelHistoryExportService(TripRepository tripRepository,
                                      RoutePointRepository routePointRepository,
                                      VisitRepository visitRepository,
                                      PropertyRepository propertyRepository,
                                      UserRepository userRepository,
                                      TripService tripService) {
        this.tripRepository = tripRepository;
        this.routePointRepository = routePointRepository;
        this.visitRepository = visitRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tripService = tripService;
    }

    /**
     * Generate Trip-Level CSV export
     */
    @Transactional(readOnly = true)
    public byte[] generateTripsCsv(Long userId, String startDate, String endDate, boolean includeStops) {
        List<Trip> trips = getFilteredTrips(userId, startDate, endDate);

        StringBuilder sb = new StringBuilder();
        // UTF-8 BOM for Microsoft Excel compatibility
        sb.append('\uFEFF');

        if (includeStops) {
            sb.append("Trip ID,Trip Name,Trip Date,Start Time,End Time,Start Location,End Location,Total Distance,Duration,Number of Stops,Trip Status,Visited Stops\n");
        } else {
            sb.append("Trip ID,Trip Name,Trip Date,Start Time,End Time,Start Location,End Location,Total Distance,Duration,Number of Stops,Trip Status\n");
        }

        for (Trip trip : trips) {
            TripTimelineDto timeline = tripService.getTripTimeline(trip.getId(), userId);
            String tripDate = getTripDate(trip);
            String startTime = formatTime(trip.getStartTime());
            String endTime = formatTime(trip.getEndTime());
            String startLoc = trip.getStartLocation() != null ? trip.getStartLocation() : "Home Base";
            String endLoc = trip.getEndLocation() != null ? trip.getEndLocation() : "Destination";
            String distance = trip.getTotalDistance() != null ? trip.getTotalDistance() : "Not recorded";
            String duration = trip.getTotalDuration() != null ? trip.getTotalDuration() : "Not recorded";
            int stopsCount = timeline != null && timeline.getStops() != null ? timeline.getStops().size() : 0;
            String status = trip.getStatus() != null ? trip.getStatus().toUpperCase() : "COMPLETED";

            sb.append(escapeCsv(trip.getId())).append(",");
            sb.append(escapeCsv(trip.getTripName() != null ? trip.getTripName() : "Trip " + trip.getId())).append(",");
            sb.append(escapeCsv(tripDate)).append(",");
            sb.append(escapeCsv(startTime)).append(",");
            sb.append(escapeCsv(endTime)).append(",");
            sb.append(escapeCsv(startLoc)).append(",");
            sb.append(escapeCsv(endLoc)).append(",");
            sb.append(escapeCsv(distance)).append(",");
            sb.append(escapeCsv(duration)).append(",");
            sb.append(stopsCount).append(",");
            sb.append(escapeCsv(status));

            if (includeStops) {
                sb.append(",");
                if (timeline != null && timeline.getStops() != null && !timeline.getStops().isEmpty()) {
                    List<String> stopStrings = new ArrayList<>();
                    for (int i = 0; i < timeline.getStops().size(); i++) {
                        TripTimelineStopDto s = timeline.getStops().get(i);
                        StringBuilder stopDetail = new StringBuilder();
                        stopDetail.append(i + 1).append(". ").append(s.getLocationName());
                        if (s.getArrivalTimeFormatted() != null) {
                            stopDetail.append(" (Arrived: ").append(s.getArrivalTimeFormatted());
                            if (s.getDepartureTimeFormatted() != null && !s.getDepartureTimeFormatted().isBlank()) {
                                stopDetail.append(", Departed: ").append(s.getDepartureTimeFormatted());
                            }
                            stopDetail.append(")");
                        }
                        if (s.getNotes() != null && !s.getNotes().isBlank()) {
                            stopDetail.append(" [Notes: ").append(s.getNotes().replace("\n", " ").trim()).append("]");
                        }
                        stopStrings.add(stopDetail.toString());
                    }
                    sb.append(escapeCsv(String.join("; ", stopStrings)));
                } else {
                    sb.append(escapeCsv("No stops recorded"));
                }
            }
            sb.append("\n");
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Generate Route Points CSV export containing actual recorded GPS breadcrumbs
     */
    @Transactional(readOnly = true)
    public byte[] generateRoutePointsCsv(Long userId, String startDate, String endDate) {
        List<Trip> trips = getFilteredTrips(userId, startDate, endDate);

        StringBuilder sb = new StringBuilder();
        // UTF-8 BOM
        sb.append('\uFEFF');

        sb.append("Trip ID,Trip Name,Trip Date,Point Sequence,Latitude,Longitude,Recorded Timestamp,GPS Accuracy\n");

        for (Trip trip : trips) {
            String tripDate = getTripDate(trip);
            String tripName = trip.getTripName() != null ? trip.getTripName() : "Trip " + trip.getId();

            List<RoutePoint> rawPoints = routePointRepository.findByTripIdOrderByTimestampAsc(trip.getId());
            // Filter and sort chronologically
            List<RoutePoint> sortedPoints = (rawPoints != null ? rawPoints : Collections.<RoutePoint>emptyList())
                    .stream()
                    .sorted((a, b) -> {
                        int seqA = a.getSequenceNumber() != null ? a.getSequenceNumber() : 0;
                        int seqB = b.getSequenceNumber() != null ? b.getSequenceNumber() : 0;
                        if (seqA != seqB) return Integer.compare(seqA, seqB);
                        String tA = a.getRecordedAt() != null ? a.getRecordedAt() : a.getTimestamp();
                        String tB = b.getRecordedAt() != null ? b.getRecordedAt() : b.getTimestamp();
                        if (tA != null && tB != null) return tA.compareTo(tB);
                        return a.getId().compareTo(b.getId());
                    })
                    .toList();

            if (sortedPoints.isEmpty()) {
                // Clearly indicate when GPS route points are unavailable
                sb.append(escapeCsv(trip.getId())).append(",");
                sb.append(escapeCsv(tripName)).append(",");
                sb.append(escapeCsv(tripDate)).append(",");
                sb.append("-").append(",");
                sb.append("Not recorded").append(",");
                sb.append("Not recorded").append(",");
                sb.append("Not recorded").append(",");
                sb.append("Not recorded").append("\n");
            } else {
                int seq = 1;
                for (RoutePoint pt : sortedPoints) {
                    sb.append(escapeCsv(trip.getId())).append(",");
                    sb.append(escapeCsv(tripName)).append(",");
                    sb.append(escapeCsv(tripDate)).append(",");
                    sb.append(seq++).append(",");
                    sb.append(pt.getLatitude() != null ? String.format(Locale.US, "%.6f", pt.getLatitude()) : "").append(",");
                    sb.append(pt.getLongitude() != null ? String.format(Locale.US, "%.6f", pt.getLongitude()) : "").append(",");
                    sb.append(escapeCsv(pt.getRecordedAt() != null ? pt.getRecordedAt() : (pt.getTimestamp() != null ? pt.getTimestamp() : "Not recorded"))).append(",");
                    sb.append(pt.getAccuracy() != null ? pt.getAccuracy() + "m" : "Not recorded").append("\n");
                }
            }
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Generate Professional Travel History PDF Report
     */
    @Transactional(readOnly = true)
    public byte[] generateTravelHistoryPdf(Long userId, String startDate, String endDate, boolean includeStops) {
        List<Trip> trips = getFilteredTrips(userId, startDate, endDate);
        User user = userRepository.findById(userId).orElse(null);
        String userName = user != null ? (user.getFullName() != null ? user.getFullName() : user.getUsername()) : "RoomTrail Explorer";

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 40, 40);

        try {
            PdfWriter writer = PdfWriter.getInstance(document, baos);

            // Add Footer with page numbering
            HeaderFooter footer = new HeaderFooter(new Phrase("RoomTrail Travel History Report | Page ", FontFactory.getFont(FontFactory.HELVETICA, 8, COLOR_TEXT_MUTED)), true);
            footer.setBorder(Rectangle.NO_BORDER);
            footer.setAlignment(Element.ALIGN_RIGHT);
            document.setFooter(footer);

            document.open();

            // 1. BRANDING HEADER
            PdfPTable headerTable = new PdfPTable(2);
            headerTable.setWidthPercentage(100);
            headerTable.setWidths(new float[]{65, 35});
            headerTable.setSpacingAfter(15);

            PdfPCell titleCell = new PdfPCell();
            titleCell.setBorder(Rectangle.NO_BORDER);
            Paragraph brandTitle = new Paragraph("ROOMTRAIL", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, COLOR_PRIMARY));
            Paragraph reportSubtitle = new Paragraph("Travel History & Recorded Journeys Report", FontFactory.getFont(FontFactory.HELVETICA, 11, COLOR_SECONDARY));
            titleCell.addElement(brandTitle);
            titleCell.addElement(reportSubtitle);
            headerTable.addCell(titleCell);

            PdfPCell metaCell = new PdfPCell();
            metaCell.setBorder(Rectangle.NO_BORDER);
            metaCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            Paragraph exportDate = new Paragraph("Export Date: " + LocalDate.now().format(DateTimeFormatter.ofPattern("MMM dd, yyyy")), FontFactory.getFont(FontFactory.HELVETICA, 9, COLOR_TEXT_DARK));
            exportDate.setAlignment(Element.ALIGN_RIGHT);
            String dateRangeText = (startDate != null || endDate != null)
                    ? (startDate != null ? startDate : "Beginning") + " to " + (endDate != null ? endDate : "Present")
                    : "All Recorded Travel History";
            Paragraph dateRange = new Paragraph("Date Range: " + dateRangeText, FontFactory.getFont(FontFactory.HELVETICA, 8, COLOR_TEXT_MUTED));
            dateRange.setAlignment(Element.ALIGN_RIGHT);
            Paragraph userLine = new Paragraph("User: " + userName, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, COLOR_ACCENT));
            userLine.setAlignment(Element.ALIGN_RIGHT);
            metaCell.addElement(exportDate);
            metaCell.addElement(dateRange);
            metaCell.addElement(userLine);
            headerTable.addCell(metaCell);

            document.add(headerTable);

            // Divider Line
            PdfPTable divider = new PdfPTable(1);
            divider.setWidthPercentage(100);
            divider.setSpacingAfter(15);
            PdfPCell dCell = new PdfPCell();
            dCell.setFixedHeight(2);
            dCell.setBackgroundColor(COLOR_PRIMARY);
            dCell.setBorder(Rectangle.NO_BORDER);
            divider.addCell(dCell);
            document.add(divider);

            // 2. OVERVIEW METRICS TABLE (KPI Cards)
            int totalTrips = trips.size();
            int totalStops = 0;
            for (Trip t : trips) {
                TripTimelineDto tl = tripService.getTripTimeline(t.getId(), userId);
                if (tl != null && tl.getStops() != null) {
                    totalStops += tl.getStops().size();
                }
            }

            PdfPTable kpiTable = new PdfPTable(3);
            kpiTable.setWidthPercentage(100);
            kpiTable.setWidths(new float[]{33, 34, 33});
            kpiTable.setSpacingAfter(18);

            kpiTable.addCell(createKpiCell("TOTAL RECORDED TRIPS", String.valueOf(totalTrips), COLOR_PRIMARY));
            kpiTable.addCell(createKpiCell("VISITED STOPS RECORDED", String.valueOf(totalStops), COLOR_ACCENT));
            kpiTable.addCell(createKpiCell("DATE RANGE FILTER", (startDate != null || endDate != null) ? "Custom Filter Active" : "Full History", COLOR_SECONDARY));

            document.add(kpiTable);

            // 3. TRIP SUMMARIES
            if (trips.isEmpty()) {
                Paragraph emptyMsg = new Paragraph("No recorded travel journeys match the selected criteria.", FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 11, COLOR_TEXT_MUTED));
                emptyMsg.setAlignment(Element.ALIGN_CENTER);
                emptyMsg.setSpacingBefore(30);
                document.add(emptyMsg);
            } else {
                for (int i = 0; i < trips.size(); i++) {
                    Trip trip = trips.get(i);
                    TripTimelineDto timeline = tripService.getTripTimeline(trip.getId(), userId);

                    PdfPTable tripBox = new PdfPTable(1);
                    tripBox.setWidthPercentage(100);
                    tripBox.setSpacingAfter(14);
                    tripBox.setKeepTogether(false);

                    PdfPCell containerCell = new PdfPCell();
                    containerCell.setBorderColor(COLOR_BORDER);
                    containerCell.setBorderWidth(1);
                    containerCell.setPadding(0);
                    containerCell.setBackgroundColor(Color.WHITE);

                    // Trip Banner Header
                    PdfPTable banner = new PdfPTable(2);
                    banner.setWidthPercentage(100);
                    banner.setWidths(new float[]{70, 30});

                    PdfPCell bLeft = new PdfPCell();
                    bLeft.setBackgroundColor(COLOR_PRIMARY);
                    bLeft.setPadding(8);
                    bLeft.setBorder(Rectangle.NO_BORDER);
                    String tripTitle = (i + 1) + ". " + (trip.getTripName() != null ? trip.getTripName() : "Trip " + trip.getId());
                    Paragraph pName = new Paragraph(tripTitle, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE));
                    Paragraph pDate = new Paragraph("Trip Date: " + getTripDate(trip), FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(203, 213, 225)));
                    bLeft.addElement(pName);
                    bLeft.addElement(pDate);
                    banner.addCell(bLeft);

                    PdfPCell bRight = new PdfPCell();
                    bRight.setBackgroundColor(COLOR_PRIMARY);
                    bRight.setPadding(8);
                    bRight.setBorder(Rectangle.NO_BORDER);
                    bRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    String statusText = (trip.getStatus() != null ? trip.getStatus().toUpperCase() : "COMPLETED");
                    Paragraph pStatus = new Paragraph(statusText, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, COLOR_SUCCESS));
                    pStatus.setAlignment(Element.ALIGN_RIGHT);
                    banner.addCell(bRight);

                    containerCell.addElement(banner);

                    // Trip Details Grid
                    PdfPTable detailsTable = new PdfPTable(4);
                    detailsTable.setWidthPercentage(100);
                    detailsTable.setWidths(new float[]{25, 25, 25, 25});
                    detailsTable.setSpacingBefore(6);
                    detailsTable.setSpacingAfter(6);

                    detailsTable.addCell(createGridCell("START LOCATION", trip.getStartLocation() != null ? trip.getStartLocation() : "Home Base", formatTime(trip.getStartTime())));
                    detailsTable.addCell(createGridCell("END LOCATION", trip.getEndLocation() != null ? trip.getEndLocation() : "Destination", formatTime(trip.getEndTime())));
                    detailsTable.addCell(createGridCell("TOTAL DISTANCE", trip.getTotalDistance() != null ? trip.getTotalDistance() : "Not recorded", ""));
                    detailsTable.addCell(createGridCell("DURATION", trip.getTotalDuration() != null ? trip.getTotalDuration() : "Not recorded", ""));

                    containerCell.addElement(detailsTable);

                    // Visited Stops section if requested
                    if (includeStops && timeline != null && timeline.getStops() != null && !timeline.getStops().isEmpty()) {
                        Paragraph stopsHeading = new Paragraph("  VISITED STOPS (" + timeline.getStops().size() + ")", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, COLOR_SECONDARY));
                        stopsHeading.setSpacingBefore(4);
                        stopsHeading.setSpacingAfter(4);
                        containerCell.addElement(stopsHeading);

                        PdfPTable stopsTable = new PdfPTable(6);
                        stopsTable.setWidthPercentage(98);
                        stopsTable.setWidths(new float[]{6, 26, 26, 14, 14, 14});
                        stopsTable.setSpacingAfter(8);

                        // Header row
                        stopsTable.addCell(createTableHeadCell("#"));
                        stopsTable.addCell(createTableHeadCell("Location Name"));
                        stopsTable.addCell(createTableHeadCell("Address"));
                        stopsTable.addCell(createTableHeadCell("Arrival"));
                        stopsTable.addCell(createTableHeadCell("Departure"));
                        stopsTable.addCell(createTableHeadCell("Duration"));

                        for (int sIdx = 0; sIdx < timeline.getStops().size(); sIdx++) {
                            TripTimelineStopDto stop = timeline.getStops().get(sIdx);
                            Color rowBg = (sIdx % 2 == 0) ? Color.WHITE : COLOR_ROW_ALT;

                            stopsTable.addCell(createTableCell(String.valueOf(sIdx + 1), rowBg));
                            stopsTable.addCell(createTableCell(stop.getLocationName(), rowBg));
                            stopsTable.addCell(createTableCell(stop.getAddress() != null ? stop.getAddress() : "-", rowBg));
                            stopsTable.addCell(createTableCell(stop.getArrivalTimeFormatted() != null ? stop.getArrivalTimeFormatted() : "-", rowBg));
                            stopsTable.addCell(createTableCell(stop.getDepartureTimeFormatted() != null ? stop.getDepartureTimeFormatted() : "-", rowBg));
                            stopsTable.addCell(createTableCell(stop.getDuration() != null ? stop.getDuration() : "-", rowBg));

                            // User's personal notes on separate sub-row if present
                            if (stop.getNotes() != null && !stop.getNotes().isBlank()) {
                                PdfPCell noteCell = new PdfPCell(new Phrase("Personal Notes: " + stop.getNotes().trim(), FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 7, COLOR_TEXT_MUTED)));
                                noteCell.setColspan(6);
                                noteCell.setBackgroundColor(rowBg);
                                noteCell.setPadding(4);
                                noteCell.setBorderColor(COLOR_BORDER);
                                stopsTable.addCell(noteCell);
                            }
                        }
                        containerCell.addElement(stopsTable);
                    } else if (includeStops) {
                        Paragraph noStops = new Paragraph("  No stationary stops detected on this trip.", FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8, COLOR_TEXT_MUTED));
                        noStops.setSpacingAfter(6);
                        containerCell.addElement(noStops);
                    }

                    // GPS Route availability note
                    long routePtsCount = routePointRepository.countByTripId(trip.getId());
                    Paragraph gpsNote = new Paragraph("  Recorded GPS Breadcrumbs: " + (routePtsCount > 0 ? (routePtsCount + " recorded track points") : "None recorded") + "  |  Trip ID: " + trip.getId(), FontFactory.getFont(FontFactory.HELVETICA, 7, COLOR_TEXT_MUTED));
                    gpsNote.setSpacingAfter(6);
                    containerCell.addElement(gpsNote);

                    tripBox.addCell(containerCell);
                    document.add(tripBox);
                }
            }

            document.close();
        } catch (DocumentException e) {
            throw new RuntimeException("Failed to generate Travel History PDF report", e);
        }

        return baos.toByteArray();
    }

    // --- Helper Methods ---

    private List<Trip> getFilteredTrips(Long userId, String startDate, String endDate) {
        List<Trip> allUserTrips = tripRepository.findByUserId(userId);
        if (allUserTrips == null) {
            return Collections.emptyList();
        }

        return allUserTrips.stream()
                .filter(trip -> {
                    String tripDate = getTripDate(trip);
                    if (tripDate == null) return true;
                    if (startDate != null && !startDate.isBlank() && tripDate.compareTo(startDate.trim()) < 0) {
                        return false;
                    }
                    if (endDate != null && !endDate.isBlank() && tripDate.compareTo(endDate.trim()) > 0) {
                        return false;
                    }
                    return true;
                })
                .sorted((a, b) -> {
                    String dateA = getTripDate(a);
                    String dateB = getTripDate(b);
                    int cmp = dateA.compareTo(dateB);
                    if (cmp != 0) return cmp;
                    String tA = a.getStartTime() != null ? a.getStartTime() : "";
                    String tB = b.getStartTime() != null ? b.getStartTime() : "";
                    return tA.compareTo(tB);
                })
                .collect(Collectors.toList());
    }

    private String getTripDate(Trip trip) {
        if (trip == null) return "2026-11-17";
        if (trip.getScheduledDate() != null && !trip.getScheduledDate().isBlank()) {
            return trip.getScheduledDate().trim();
        }
        if (trip.getStartTime() != null && !trip.getStartTime().isBlank()) {
            String s = trip.getStartTime().trim();
            if (s.length() >= 10 && s.charAt(4) == '-' && s.charAt(7) == '-') {
                return s.substring(0, 10);
            }
        }
        if (trip.getCreatedAt() != null) {
            return trip.getCreatedAt().toLocalDate().toString();
        }
        return "2026-11-17";
    }

    private String formatTime(String raw) {
        if (raw == null || raw.isBlank()) return "Not recorded";
        if (raw.length() >= 16 && raw.contains("T")) {
            return raw.substring(11, 16);
        }
        if (raw.contains(":") && raw.length() <= 8) {
            return raw;
        }
        return raw;
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        String val = value.trim();
        if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }

    private PdfPCell createKpiCell(String label, String value, Color accentColor) {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(COLOR_LIGHT_BG);
        cell.setBorderColor(COLOR_BORDER);
        cell.setBorderWidth(1);
        cell.setPadding(8);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);

        Paragraph pVal = new Paragraph(value, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, accentColor));
        pVal.setAlignment(Element.ALIGN_CENTER);
        Paragraph pLbl = new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA, 7, COLOR_TEXT_MUTED));
        pLbl.setAlignment(Element.ALIGN_CENTER);

        cell.addElement(pVal);
        cell.addElement(pLbl);
        return cell;
    }

    private PdfPCell createGridCell(String label, String value, String sub) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(6);

        Paragraph pLbl = new Paragraph(label, FontFactory.getFont(FontFactory.HELVETICA, 7, COLOR_TEXT_MUTED));
        Paragraph pVal = new Paragraph(value, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, COLOR_TEXT_DARK));
        cell.addElement(pLbl);
        cell.addElement(pVal);
        if (sub != null && !sub.isBlank()) {
            Paragraph pSub = new Paragraph(sub, FontFactory.getFont(FontFactory.HELVETICA, 8, COLOR_ACCENT));
            cell.addElement(pSub);
        }
        return cell;
    }

    private PdfPCell createTableHeadCell(String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE)));
        cell.setBackgroundColor(COLOR_SECONDARY);
        cell.setBorderColor(COLOR_BORDER);
        cell.setPadding(4);
        return cell;
    }

    private PdfPCell createTableCell(String text, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, FontFactory.getFont(FontFactory.HELVETICA, 8, COLOR_TEXT_DARK)));
        cell.setBackgroundColor(bg);
        cell.setBorderColor(COLOR_BORDER);
        cell.setPadding(4);
        return cell;
    }
}
