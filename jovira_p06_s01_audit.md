# Jovira Backend — `reservations/views.py` PreventHardDeleteMixin Audit

Source: `jovira-backend/reservations/views.py`

`PreventHardDeleteMixin` (defined at line 40) overrides `destroy()` to raise `MethodNotAllowed`, disabling hard deletes and forcing use of the cancellation workflow instead.

## 1. ViewSets WITH `PreventHardDeleteMixin`

| # | ViewSet | Line |
|---|---------|------|
| 1 | `AdminReservationViewSet` | 221 |
| 2 | `AdminTouristViewSet` | 665 |
| 3 | `AdminHotelBookingViewSet` | 691 |
| 4 | `AdminExcursionBookingViewSet` | 972 |
| 5 | `AdminTransferServiceViewSet` | 1031 |
| 6 | `AdminExcursionServiceViewSet` | 1094 |

## 2. ViewSets WITHOUT `PreventHardDeleteMixin`

| # | ViewSet | Line | Notes |
|---|---------|------|-------|
| 1 | `AdminReservationActivityLogViewSet` | 637 | Read-only (`ReadOnlyModelViewSet`) — no `destroy()` action exists anyway |
| 2 | `ClientReservationViewSet` | 655 | Client-facing |
| 3 | `ClientTouristViewSet` | 676 | Client-facing |
| 4 | `ClientHotelBookingViewSet` | 777 | Client-facing; defines its own `perform_destroy` that adjusts room availability then hard-deletes |
| 5 | `AdminFlightTicketViewSet` | 842 | **Admin viewset** — defines `perform_destroy` that hard-deletes the instance |
| 6 | `AdminOtherServiceViewSet` | 898 | **Admin viewset** — defines `perform_destroy` that hard-deletes the instance |
| 7 | `ClientFlightTicketViewSet` | 953 | Client-facing |
| 8 | `ClientExcursionBookingViewSet` | 1013 | Client-facing |
| 9 | `ClientTransferServiceViewSet` | 1074 | Client-facing |
| 10 | `ClientExcursionServiceViewSet` | 1104 | Client-facing |

**Flag:** `AdminFlightTicketViewSet` and `AdminOtherServiceViewSet` are both `Admin*` viewsets (unlike the other unprotected ones, which are all `Client*`) and both explicitly implement `perform_destroy` that permanently deletes the row — inconsistent with the other Admin viewsets, which all block hard deletes via the mixin.

## 3. Class definition headers for viewsets without the mixin

```python
class AdminReservationActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
```

```python
class ClientReservationViewSet(viewsets.ModelViewSet):
```

```python
class ClientTouristViewSet(viewsets.ModelViewSet):
```

```python
class ClientHotelBookingViewSet(viewsets.ModelViewSet):
```

```python
class AdminFlightTicketViewSet(viewsets.ModelViewSet):
```

```python
class AdminOtherServiceViewSet(viewsets.ModelViewSet):
```

```python
class ClientFlightTicketViewSet(viewsets.ModelViewSet):
```

```python
class ClientExcursionBookingViewSet(viewsets.ModelViewSet):
```

```python
class ClientTransferServiceViewSet(viewsets.ModelViewSet):
```

```python
class ClientExcursionServiceViewSet(viewsets.ModelViewSet):
```

## 4. `AdminOtherServiceViewSet` specific check

```python
class AdminOtherServiceViewSet(viewsets.ModelViewSet):
    ...
    permission_classes = (ReadOnlyOrReservationOperationsRole,)
    ...
    def perform_destroy(self, instance):
        _ensure_reservation_is_editable_for_request(self.request, instance.reservation)
        reservation = instance.reservation
        service_name = instance.service_name
        instance.delete()
        ...
```

**Result: `AdminOtherServiceViewSet` does NOT have `PreventHardDeleteMixin`.** It permits real hard deletes (with an activity log entry recorded before the row is gone), which is inconsistent with every other `Admin*ViewSet` in the file except `AdminFlightTicketViewSet`.
